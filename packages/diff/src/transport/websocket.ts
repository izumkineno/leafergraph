import { TransportAdapter } from "./adapter";
import type { GraphDocumentDiff } from "../types";

/**
 * WebSocket 传输适配器配置。
 */
export interface WebSocketTransportConfig {
  /** WebSocket 服务器 URL。 */
  url: string;
  /** 重连间隔（毫秒）。 */
  reconnectInterval?: number;
  /** 最大重连次数。 */
  maxReconnectAttempts?: number;
  /** 自定义 WebSocket 协议。 */
  protocols?: string | string[];
}

/**
 * WebSocket 传输适配器。
 * 通过 WebSocket 协议实时传输 diff 数据。
 */
export class WebSocketTransportAdapter extends TransportAdapter {
  private config: WebSocketTransportConfig;
  private ws: WebSocket | null = null;
  private connected: boolean = false;
  private reconnectAttempts: number = 0;
  private messageQueue: GraphDocumentDiff[] = [];
  private resolveMap: Map<number, (diff: GraphDocumentDiff) => void> = new Map();
  private messageId: number = 0;
  
  constructor(config: WebSocketTransportConfig) {
    super();
    this.config = {
      reconnectInterval: 3000,
      maxReconnectAttempts: 5,
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
    
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // 加入消息队列
      this.messageQueue.push(diff);
      return;
    }
    
    try {
      this.ws.send(JSON.stringify(diff));
      
      // 处理队列中的消息
      while (this.messageQueue.length > 0) {
        const queuedDiff = this.messageQueue.shift();
        if (queuedDiff) {
          this.ws.send(JSON.stringify(queuedDiff));
        }
      }
    } catch (error) {
      // 发送失败，重新加入队列
      this.messageQueue.push(diff);
      throw error;
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
    
    return new Promise((resolve) => {
      const id = this.messageId++;
      this.resolveMap.set(id, resolve);
    });
  }
  
  /**
   * 连接到传输服务。
   * 
   * @returns Promise<void>
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.url, this.config.protocols);
        
        this.ws.onopen = () => {
          this.connected = true;
          this.reconnectAttempts = 0;
          resolve();
        };
        
        this.ws.onmessage = (event) => {
          try {
            const diff = JSON.parse(event.data) as GraphDocumentDiff;
            
            // 处理接收的消息
            for (const [id, resolve] of this.resolveMap.entries()) {
              resolve(diff);
              this.resolveMap.delete(id);
              break;
            }
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };
        
        this.ws.onclose = () => {
          this.connected = false;
          this.handleReconnect();
        };
        
        this.ws.onerror = (error) => {
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * 断开连接。
   * 
   * @returns Promise<void>
   */
  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }
  
  /**
   * 检查连接状态。
   * 
   * @returns boolean
   */
  isConnected(): boolean {
    return Boolean(this.connected && this.ws && this.ws.readyState === WebSocket.OPEN);
  }
  
  /**
   * 处理重连。
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts!) {
      console.error('Max reconnect attempts reached');
      return;
    }
    
    this.reconnectAttempts++;
    console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.config.maxReconnectAttempts!})`);
    
    setTimeout(() => {
      this.connect().catch(error => {
        console.error('Reconnect failed:', error);
      });
    }, this.config.reconnectInterval!);
  }
}
