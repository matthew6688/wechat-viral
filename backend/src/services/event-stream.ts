import { Response } from 'express';

interface EventStreamClient {
  id: string;
  response: Response;
  connectedAt: Date;
}

interface EventData {
  event_type: string;
  timestamp: string;
  user_id?: string;
  user_name?: string;
  event_data?: any;
  source?: string;
  is_test?: boolean;
}

class EventStreamManager {
  private clients: Map<string, EventStreamClient> = new Map();
  private eventBuffer: EventData[] = [];
  private readonly MAX_BUFFER_SIZE = 100;

  /**
   * Add a new SSE client connection
   */
  addClient(clientId: string, response: Response): void {
    // Set SSE headers
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Send initial connection message
    this.sendToClient(clientId, {
      type: 'connected',
      data: { message: 'Connected to event stream', clientId },
    });

    // Send buffered events to new client
    if (this.eventBuffer.length > 0) {
      this.sendToClient(clientId, {
        type: 'buffer',
        data: { events: this.eventBuffer.slice(-20) }, // Send last 20 events
      });
    }

    // Store client
    this.clients.set(clientId, {
      id: clientId,
      response,
      connectedAt: new Date(),
    });

    console.log(`[EventStream] Client connected: ${clientId} (Total: ${this.clients.size})`);

    // Handle client disconnect
    response.on('close', () => {
      this.removeClient(clientId);
    });
  }

  /**
   * Remove a client connection
   */
  removeClient(clientId: string): void {
    if (this.clients.has(clientId)) {
      this.clients.delete(clientId);
      console.log(`[EventStream] Client disconnected: ${clientId} (Total: ${this.clients.size})`);
    }
  }

  /**
   * Broadcast event to all connected clients
   */
  broadcastEvent(event: EventData): void {
    // Add to buffer
    this.eventBuffer.push(event);
    if (this.eventBuffer.length > this.MAX_BUFFER_SIZE) {
      this.eventBuffer.shift(); // Remove oldest event
    }

    // Format event for SSE
    const formattedEvent = this.formatEvent(event);

    // Broadcast to all clients
    const disconnectedClients: string[] = [];
    this.clients.forEach((client, clientId) => {
      try {
        this.sendToClient(clientId, {
          type: 'event',
          data: formattedEvent,
        });
      } catch (error) {
        console.error(`[EventStream] Error sending to client ${clientId}:`, error);
        disconnectedClients.push(clientId);
      }
    });

    // Clean up disconnected clients
    disconnectedClients.forEach((clientId) => this.removeClient(clientId));
  }

  /**
   * Send message to specific client
   */
  private sendToClient(clientId: string, message: { type: string; data: any }): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const sseMessage = `event: ${message.type}\ndata: ${JSON.stringify(message.data)}\n\n`;
      client.response.write(sseMessage);
    } catch (error) {
      console.error(`[EventStream] Error writing to client ${clientId}:`, error);
      this.removeClient(clientId);
    }
  }

  /**
   * Format event data for frontend consumption
   */
  private formatEvent(event: EventData): any {
    return {
      id: `${event.event_type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: event.event_type,
      timestamp: event.timestamp,
      time: new Date(event.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }),
      user: event.user_id
        ? {
            id: event.user_id,
            name: event.user_name || 'Unknown',
          }
        : null,
      data: event.event_data || {},
      source: event.source || 'system',
      is_test: event.is_test || false,
    };
  }

  /**
   * Get number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get buffer size
   */
  getBufferSize(): number {
    return this.eventBuffer.length;
  }
}

// Singleton instance
export const eventStreamManager = new EventStreamManager();

/**
 * Broadcast an event to all connected SSE clients
 */
export function broadcastEvent(event: EventData): void {
  eventStreamManager.broadcastEvent(event);
}
