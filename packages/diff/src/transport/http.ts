import { TransportAdapter } from "./adapter";
import type { GraphDocumentDiff } from "../types";

/**
 * HTTP 传输适配器配置。
 */
export interface HttpTransportConfig {
  /** 服务器 URL。 */
  url: string;
  /** 请求超时时间（毫秒）。 */
  timeout?: number;
  /** 自定义请求头。 */
  headers?: Record<string, string>;
  /** 是否启用重试。 */
  retry?: boolean;
  /** 重试次数。 */
  retryAttempts?: number;
  /** 重试延迟（毫秒）。 */
  retryDelay?: number;
}

/**
 * HTTP 传输适配器。
 * 通过 HTTP 协议传输 diff 数据。
 */
export class HttpTransportAdapter extends TransportAdapter {
  private config: HttpTransportConfig;
  private connected: boolean = false;
  
  constructor(config: HttpTransportConfig) {
    super();
    this.config = {
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      retry: true,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config
    };
  }
  
  /**
   * 发送 diff 数据。
   * 
   * @param diff - 文档差异
   * @returns Promise<void>
   */
  async send(diff: GraphDocumentDiff): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
    
    const options: RequestInit = {
      method: "POST",
      headers: this.config.headers,
      body: JSON.stringify(diff),
      signal: AbortSignal.timeout(this.config.timeout!)
    };
    
    let attempts = 0;
    while (attempts <= this.config.retryAttempts!) {
      try {
        const response = await fetch(this.config.url, options);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return;
      } catch (error) {
        if (!this.config.retry || attempts >= this.config.retryAttempts!) {
          throw error;
        }
        
        attempts++;
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay!));
      }
    }
  }
  
  /**
   * 接收 diff 数据。
   * 
   * @returns Promise<GraphDocumentDiff>
   */
  async receive(): Promise<GraphDocumentDiff> {
    if (!this.connected) {
      await this.connect();
    }
    
    const options: RequestInit = {
      method: "GET",
      headers: this.config.headers,
      signal: AbortSignal.timeout(this.config.timeout!)
    };
    
    let attempts = 0;
    while (attempts <= this.config.retryAttempts!) {
      try {
        const response = await fetch(this.config.url, options);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const diff = await response.json() as GraphDocumentDiff;
        return diff;
      } catch (error) {
        if (!this.config.retry || attempts >= this.config.retryAttempts!) {
          throw error;
        }
        
        attempts++;
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay!));
      }
    }
    
    throw new Error("Failed to receive diff");
  }
  
  /**
   * 连接到传输服务。
   * 
   * @returns Promise<void>
   */
  async connect(): Promise<void> {
    // HTTP 是无状态的，这里只是标记连接状态
    this.connected = true;
  }
  
  /**
   * 断开连接。
   * 
   * @returns Promise<void>
   */
  async disconnect(): Promise<void> {
    this.connected = false;
  }
  
  /**
   * 检查连接状态。
   * 
   * @returns boolean
   */
  isConnected(): boolean {
    return this.connected;
  }
}
