import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const repoRoot = path.resolve(import.meta.dirname, "..");
const sourceRoots = [
  path.join(repoRoot, "packages"),
  path.join(repoRoot, "example"),
  path.join(repoRoot, "templates")
];
const allowedExtensions = new Set([".ts", ".tsx", ".mts", ".cts"]);
const ignoredDirectories = new Set([
  "node_modules",
  "dist",
  ".git",
  ".turbo",
  "coverage",
  "tests",
  "test",
  "scripts"
]);
const longFunctionThreshold = 40;
const requiredSectionCommentsInLongFunction = 2;
const reportOnly = process.argv.includes("--report-only");

const files = collectSourceFiles();
const buckets = new Map();
const missingJsDoc = [];
const missingParamTags = [];
const missingReturnsTags = [];
const missingSections = [];

let totalDeclarations = 0;
let documentedDeclarations = 0;

for (const filePath of files) {
  const sourceText = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true
  );
  const relativeFilePath = toPosix(path.relative(repoRoot, filePath));
  const bucketName = resolveBucketName(relativeFilePath);
  const bucket = getOrCreateBucket(bucketName);

  visitNode(sourceFile, (node) => {
    const declarationInfo = getDeclarationInfo(node, sourceFile);
    if (!declarationInfo) {
      return;
    }

    totalDeclarations += 1;
    bucket.total += 1;

    const documented = hasJsDoc(node, sourceFile);
    if (documented) {
      documentedDeclarations += 1;
      bucket.documented += 1;
    } else {
      missingJsDoc.push({
        file: relativeFilePath,
        name: declarationInfo.name,
        kind: declarationInfo.kind
      });
      return;
    }

    if (declarationInfo.kind !== "class") {
      const jsDocText = getJsDocText(node, sourceFile);
      const expectedParamCount = getFunctionParameterCount(node);
      const actualParamCount = countParamTags(jsDocText);

      if (actualParamCount < expectedParamCount) {
        missingParamTags.push({
          file: relativeFilePath,
          name: declarationInfo.name,
          kind: declarationInfo.kind,
          expected: expectedParamCount,
          actual: actualParamCount
        });
      }

      if (declarationInfo.kind !== "constructor" && !hasReturnsTag(jsDocText)) {
        missingReturnsTags.push({
          file: relativeFilePath,
          name: declarationInfo.name,
          kind: declarationInfo.kind
        });
      }
    }

    const functionLength = getFunctionBodyLineCount(node, sourceFile);
    if (functionLength < longFunctionThreshold) {
      return;
    }

    bucket.longFunctions += 1;
    const sectionCommentCount = countSectionComments(node, sourceFile);
    if (sectionCommentCount < requiredSectionCommentsInLongFunction) {
      missingSections.push({
        file: relativeFilePath,
        name: declarationInfo.name,
        kind: declarationInfo.kind,
        lines: functionLength,
        sectionComments: sectionCommentCount
      });
    }
  });
}

const coverage = totalDeclarations
  ? (documentedDeclarations / totalDeclarations) * 100
  : 100;

const sortedBuckets = [...buckets.entries()]
  .map(([name, stats]) => ({
    name,
    ...stats,
    coverage: stats.total ? (stats.documented / stats.total) * 100 : 100
  }))
  .sort((left, right) => left.coverage - right.coverage || right.total - left.total);

const hasErrors =
  missingJsDoc.length > 0 ||
  missingParamTags.length > 0 ||
  missingReturnsTags.length > 0 ||
  missingSections.length > 0;

printSummary({
  coverage,
  totalDeclarations,
  documentedDeclarations,
  sortedBuckets,
  missingJsDoc,
  missingParamTags,
  missingReturnsTags,
  missingSections
});

if (hasErrors && !reportOnly) {
  process.exit(1);
}

function collectSourceFiles() {
  const sourceFiles = [];

  for (const rootPath of sourceRoots) {
    walkDirectory(rootPath, sourceFiles);
  }

  return sourceFiles;
}

function walkDirectory(directoryPath, sourceFiles) {
  for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) {
        continue;
      }

      walkDirectory(path.join(directoryPath, entry.name), sourceFiles);
      continue;
    }

    const extension = path.extname(entry.name);
    if (!allowedExtensions.has(extension) || entry.name.endsWith(".d.ts")) {
      continue;
    }

    const filePath = path.join(directoryPath, entry.name);
    if (!toPosix(filePath).includes("/src/")) {
      continue;
    }

    sourceFiles.push(filePath);
  }
}

function visitNode(rootNode, visitor) {
  const walk = (node) => {
    visitor(node);
    ts.forEachChild(node, walk);
  };

  walk(rootNode);
}

function getDeclarationInfo(node, sourceFile) {
  if (ts.isClassDeclaration(node) && node.name) {
    return {
      kind: "class",
      name: node.name.text
    };
  }

  if (ts.isFunctionDeclaration(node)) {
    return {
      kind: "function",
      name: node.name?.text ?? "<anonymous>"
    };
  }

  if (ts.isMethodDeclaration(node) && isClassLike(node.parent)) {
    return {
      kind: "method",
      name: node.name?.getText(sourceFile) ?? "<anonymous>"
    };
  }

  if (ts.isConstructorDeclaration(node) && isClassLike(node.parent)) {
    return {
      kind: "constructor",
      name: "constructor"
    };
  }

  if (ts.isGetAccessorDeclaration(node) && isClassLike(node.parent)) {
    return {
      kind: "getter",
      name: node.name?.getText(sourceFile) ?? "<anonymous>"
    };
  }

  if (ts.isSetAccessorDeclaration(node) && isClassLike(node.parent)) {
    return {
      kind: "setter",
      name: node.name?.getText(sourceFile) ?? "<anonymous>"
    };
  }

  if (
    (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) &&
    node.parent &&
    ts.isVariableDeclaration(node.parent) &&
    ts.isIdentifier(node.parent.name)
  ) {
    return {
      kind: "named-function",
      name: node.parent.name.text
    };
  }

  return null;
}

function hasJsDoc(node, sourceFile) {
  const documentationNode = getDocumentationNode(node, sourceFile);
  if (documentationNode.jsDoc && documentationNode.jsDoc.length > 0) {
    return true;
  }

  const commentRanges =
    ts.getLeadingCommentRanges(sourceFile.text, documentationNode.pos) ?? [];
  return commentRanges.some((range) =>
    sourceFile.text.slice(range.pos, range.end).startsWith("/**")
  );
}

function isClassLike(node) {
  return ts.isClassDeclaration(node) || ts.isClassExpression(node);
}

function getDocumentationNode(node, sourceFile) {
  if (
    (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) &&
    node.parent &&
    ts.isVariableDeclaration(node.parent)
  ) {
    const declaration = node.parent;
    const statement = declaration.parent?.parent;

    if (statement && hasDirectJsDoc(statement, sourceFile)) {
      return statement;
    }

    if (hasDirectJsDoc(declaration, sourceFile)) {
      return declaration;
    }

    return statement ?? declaration;
  }

  return node;
}

function hasDirectJsDoc(node, sourceFile) {
  if (!node) {
    return false;
  }

  if (node.jsDoc && node.jsDoc.length > 0) {
    return true;
  }

  const commentRanges = ts.getLeadingCommentRanges(sourceFile.text, node.pos) ?? [];
  return commentRanges.some((range) =>
    sourceFile.text.slice(range.pos, range.end).startsWith("/**")
  );
}

function getJsDocText(node, sourceFile) {
  const documentationNode = getDocumentationNode(node, sourceFile);

  if (documentationNode.jsDoc?.length) {
    const doc = documentationNode.jsDoc[documentationNode.jsDoc.length - 1];
    return sourceFile.text.slice(doc.pos, doc.end);
  }

  const commentRanges =
    ts.getLeadingCommentRanges(sourceFile.text, documentationNode.pos) ?? [];
  const jsDocRange = [...commentRanges]
    .reverse()
    .find((range) => sourceFile.text.slice(range.pos, range.end).startsWith("/**"));

  return jsDocRange
    ? sourceFile.text.slice(jsDocRange.pos, jsDocRange.end)
    : "";
}

function getFunctionParameterCount(node) {
  return "parameters" in node && Array.isArray(node.parameters)
    ? node.parameters.length
    : 0;
}

function countParamTags(jsDocText) {
  return [...jsDocText.matchAll(/(^|\n)\s*\*\s*@param\b/g)].length;
}

function hasReturnsTag(jsDocText) {
  return /(^|\n)\s*\*\s*@returns?\b/.test(jsDocText);
}

function getFunctionBodyLineCount(node, sourceFile) {
  if (!node.body) {
    return 0;
  }

  const startLine = sourceFile.getLineAndCharacterOfPosition(
    node.body.getStart(sourceFile)
  ).line;
  const endLine = sourceFile.getLineAndCharacterOfPosition(node.body.getEnd()).line;
  return endLine - startLine + 1;
}

function countSectionComments(node, sourceFile) {
  if (!node.body || !ts.isBlock(node.body)) {
    return 0;
  }

  const commentPositions = new Set();
  const bodyStart = node.body.getStart(sourceFile);
  const bodyEnd = node.body.getEnd();

  visitNode(node.body, (child) => {
    if (!ts.isStatement(child) || child === node.body) {
      return;
    }

    const commentRanges = ts.getLeadingCommentRanges(sourceFile.text, child.pos) ?? [];
    for (const range of commentRanges) {
      if (range.pos < bodyStart || range.end > bodyEnd) {
        continue;
      }

      const commentText = sourceFile.text.slice(range.pos, range.end);
      if (commentText.startsWith("/**")) {
        continue;
      }

      commentPositions.add(range.pos);
    }
  });

  return commentPositions.size;
}

function resolveBucketName(relativeFilePath) {
  const segments = relativeFilePath.split("/");
  return segments.slice(0, 2).join("/");
}

function getOrCreateBucket(bucketName) {
  const existing = buckets.get(bucketName);
  if (existing) {
    return existing;
  }

  const nextBucket = {
    total: 0,
    documented: 0,
    longFunctions: 0
  };
  buckets.set(bucketName, nextBucket);
  return nextBucket;
}

function printSummary(summary) {
  const lines = [
    `JSDoc 覆盖率检查${reportOnly ? "报告" : ""}:`,
    `- 声明级函数/类总数: ${summary.totalDeclarations}`,
    `- 已有 JSDoc: ${summary.documentedDeclarations}`,
    `- 覆盖率: ${summary.coverage.toFixed(1)}%`,
    `- 缺少 JSDoc: ${summary.missingJsDoc.length}`,
    `- 缺少 @param 注释: ${summary.missingParamTags.length}`,
    `- 缺少 @returns 注释: ${summary.missingReturnsTags.length}`,
    `- 长函数缺少足够分段注释: ${summary.missingSections.length}`
  ];

  lines.push("- 分桶统计:");
  for (const bucket of summary.sortedBuckets) {
    lines.push(
      `  - ${bucket.name}: ${bucket.documented}/${bucket.total} (${bucket.coverage.toFixed(
        1
      )}%), 长函数 ${bucket.longFunctions}`
    );
  }

  if (summary.missingJsDoc.length) {
    lines.push("- 缺少 JSDoc 的声明:");
    for (const item of summary.missingJsDoc) {
      lines.push(`  - ${item.file} :: ${item.name} [${item.kind}]`);
    }
  }

  if (summary.missingParamTags.length) {
    lines.push("- 缺少 @param 注释的声明:");
    for (const item of summary.missingParamTags) {
      lines.push(
        `  - ${item.file} :: ${item.name} [${item.kind}] (需要 ${item.expected}, 当前 ${item.actual})`
      );
    }
  }

  if (summary.missingReturnsTags.length) {
    lines.push("- 缺少 @returns 注释的声明:");
    for (const item of summary.missingReturnsTags) {
      lines.push(`  - ${item.file} :: ${item.name} [${item.kind}]`);
    }
  }

  if (summary.missingSections.length) {
    lines.push("- 长函数缺少足够分段注释:");
    for (const item of summary.missingSections) {
      lines.push(
        `  - ${item.file} :: ${item.name} [${item.kind}] (${item.lines} 行, 当前注释 ${item.sectionComments})`
      );
    }
  }

  console.log(lines.join("\n"));
}

function toPosix(filePath) {
  return filePath.replaceAll("\\", "/");
}
