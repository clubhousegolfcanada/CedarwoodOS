/**
 * Webhook Handlers
 * 
 * Handles incoming webhooks from OpenPhone
 */

import { Request, Response } from 'express';
import { db } from '../../../utils/database';
import { logger } from '../../../utils/logger';
import { AppError } from '../../../middleware/errorHandler';
import { notificationService } from '../../../services/notificationService';
import crypto from 'crypto';

/**
 * Verify OpenPhone webhook signature
 */
function verifyOpenPhoneSignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Handle OpenPhone webhook
 */
export async function handleOpenPhoneWebhook(req: Request, res: Response) {
  try {
    // Database column check removed (ensureOpenPhoneColumns removed)
    
    // Get raw body for signature verification
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    const signature = req.headers['x-openphone-signature'] as string;
    const webhookSecret = process.env.OPENPHONE_WEBHOOK_SECRET;

    // Verify signature if secret is configured
    if (webhookSecret && signature) {
      const isValid = verifyOpenPhoneSignature(rawBody, signature, webhookSecret);
      if (!isValid) {
        logger.warn('Invalid OpenPhone webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    // Handle wrapped webhook structure
    const webhookData = req.body.object || req.body;
    const { type, data } = webhookData;

    logger.info('OpenPhone webhook received', {
      type,
      dataKeys: Object.keys(data || {})
    });

    // Process based on event type
    switch (type) {
      case 'message.created':
      case 'message.received':  // Incoming messages
      case 'message.delivered': // Outgoing messages
      case 'message.sent':      // Outgoing messages
        await handleMessageCreated(data, type);
        break;

      case 'message.updated':
        await handleMessageUpdated(data);
        break;
      
      case 'conversation.created':
        await handleConversationCreated(data);
        break;
      
      case 'conversation.updated':
        await handleConversationUpdated(data);
        break;
      
      case 'call.completed':
        await handleCallCompleted(data);
        break;
      
      default:
        logger.info('Unhandled webhook type', { type });
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}

/**
 * Handle message created event
 */
async function handleMessageCreated(data: any, eventType?: string) {
  const { conversationId, from, to, body, direction, createdAt } = data;

  try {
    // Determine actual direction based on event type
    let actualDirection = direction;
    if (eventType === 'message.delivered' || eventType === 'message.sent') {
      actualDirection = 'outbound';
    } else if (eventType === 'message.received') {
      actualDirection = 'inbound';
    } else if (direction) {
      actualDirection = direction === 'incoming' || direction === 'inbound' ? 'inbound' : 'outbound';
    }

    // Extract phone number based on corrected direction
    const phoneNumber = actualDirection === 'inbound' ? from : to;

    // Check if conversation exists
    const existing = await db.query(
      'SELECT id FROM openphone_conversations WHERE conversation_id = $1',
      [conversationId]
    );

    const message = {
      id: data.id,
      body,
      direction: actualDirection,
      from,
      to,
      createdAt
    };

    if (existing.rows.length === 0) {
      // Create new conversation
      await db.query(`
        INSERT INTO openphone_conversations (conversation_id, phone_number, customer_name, employee_name, messages, metadata, unread_count)
        VALUES ($1, $2, $3, 'System', $4::jsonb, '{}'::jsonb, $5)
      `, [conversationId, phoneNumber, data.contactName || null, JSON.stringify([message]), actualDirection === 'inbound' ? 1 : 0]);
    } else {
      // Add message to existing conversation
      await db.query(`
        UPDATE openphone_conversations
        SET
          messages = messages || $2::jsonb,
          updated_at = NOW(),
          last_message_at = $3,
          unread_count = CASE
            WHEN $4 = 'inbound'
            THEN unread_count + 1
            ELSE unread_count
          END
        WHERE conversation_id = $1
      `, [conversationId, JSON.stringify([message]), createdAt, actualDirection]);
    }

    // Send push notification for incoming messages
    if (actualDirection === 'inbound') {
      // Format sender name
      const senderName = data.contactName || from;
      const messagePreview = body.substring(0, 100);
      const truncatedBody = body.substring(0, 50) + (body.length > 50 ? '...' : '');
      
      // Notification payload
      const notificationPayload = {
        title: 'New OpenPhone Message',
        body: `From ${senderName}: "${truncatedBody}"`,
        icon: '/logo-192.png',
        badge: '/badge-72.png',
        tag: `message-${conversationId}`,
        requireInteraction: false,
        data: {
          type: 'messages',
          url: '/messages',
          conversationId,
          from,
          preview: messagePreview
        }
      };
      
      // Send to all relevant roles
      const roles = ['admin', 'operator', 'support'];
      await Promise.allSettled(
        roles.map(role => notificationService.sendToRole(role, notificationPayload))
      );

      // Update HubSpot if enabled
      // TODO: Implement HubSpot contact update
      // if (hubspotService && data.contactName) {
      //   try {
      //     await hubspotService.updateLastContact(from, {
      //       lastMessageDate: createdAt,
      //       lastMessagePreview: body.substring(0, 100)
      //     });
      //   } catch (hubspotError) {
      //     logger.warn('Failed to update HubSpot', { error: hubspotError });
      //   }
      // }
    }

    logger.info('Message processed', {
      conversationId,
      originalDirection: direction,
      actualDirection,
      eventType,
      from,
      to,
      phoneNumber,
      messageId: data.id
    });
  } catch (error) {
    logger.error('Error handling message created:', error);
    throw error;
  }
}

/**
 * Handle message updated event
 */
async function handleMessageUpdated(data: any) {
  // Currently just log - implement if needed
  logger.info('Message updated', { messageId: data.id });
}

/**
 * Handle conversation created event
 */
async function handleConversationCreated(data: any) {
  const { id, phoneNumber, createdAt } = data;

  try {
    await db.query(`
      INSERT INTO openphone_conversations (conversation_id, phone_number, customer_name, employee_name, messages, metadata, unread_count)
      VALUES ($1, $2, $3, 'System', '[]'::jsonb, '{}'::jsonb, 0)
    `, [id, phoneNumber, data.contactName || null]);

    logger.info('Conversation created', {
      conversationId: id,
      phoneNumber
    });
  } catch (error) {
    logger.error('Error handling conversation created:', error);
    throw error;
  }
}

/**
 * Handle conversation updated event
 */
async function handleConversationUpdated(data: any) {
  const { id, status, assignedTo } = data;

  try {
    // Note: Our schema doesn't track status or assignedTo fields
    // We could extend the schema if needed
    logger.info('Conversation status update received (not stored)', {
      conversationId: id,
      status,
      assignedTo
    });

    logger.info('Conversation updated', {
      conversationId: id,
      status,
      assignedTo
    });
  } catch (error) {
    logger.error('Error handling conversation updated:', error);
    throw error;
  }
}

/**
 * Handle call completed event
 */
async function handleCallCompleted(data: any) {
  const { conversationId, from, to, duration, recordingUrl, createdAt } = data;

  try {
    // Store call as a special message type
    const callMessage = {
      id: data.id,
      type: 'call',
      direction: data.direction,
      from,
      to,
      duration,
      recordingUrl,
      createdAt
    };

    await db.query(`
      UPDATE openphone_conversations
      SET 
        messages = messages || $2::jsonb,
        updated_at = NOW(),
        last_message_at = $3
      WHERE conversation_id = $1
    `, [conversationId, JSON.stringify([callMessage]), createdAt]);

    logger.info('Call completed processed', {
      conversationId,
      duration,
      hasRecording: !!recordingUrl
    });
  } catch (error) {
    logger.error('Error handling call completed:', error);
    throw error;
  }
}