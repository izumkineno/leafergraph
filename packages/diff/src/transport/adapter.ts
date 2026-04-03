import type { GraphDocumentDiff } from "../types";

/**
 * 传输适配器抽象基类。
 * 定义传输 diff 数据的通用接口。
 */
export abstract class TransportAdapter {
  /**
   * 发送 diff 数据。
   * 
   * @param diff - 文档差异
   * @returns Promise<void>
   */
  abstract send(diff: GraphDocumentDiff): Promise<void>;
  
  /**
   * 接收 diff 数据。
   * 
   * @returns Promise<GraphDocumentDiff>
   */
  abstract receive(): Promise<GraphDocumentDiff>;
  
  /**
   * 连接到传输服务。
   * 
   * @returns Promise<void>
   */
  abstract connect(): Promise<void>;
  
  /**
   * 断开连接。
   * 
   * @returns Promise<void>
   */
  abstract disconnect(): Promise<void>;
  
  /**
   * 检查连接状态。
   * 
   * @returns boolean
   */
  abstract isConnected(): boolean;
  
  /**
   * 重试连接。
   * 
   * @param attempts - 重试次数
   * @param delay - 重试延迟（毫秒）
   * @returns Promise<boolean>
   */
  async retryConnect(attempts: number = 3, delay: number = 1000): Promise<boolean> {
    for (let i = 0; i < attempts; i++) {
      try {
        await this.connect();
        return true;
      } catch (error) {
        if (i === attempts - 1) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    return false;
  }
}
