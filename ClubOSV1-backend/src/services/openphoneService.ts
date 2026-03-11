/**
 * OpenPhone Service Stub
 *
 * OpenPhone integration has been removed as part of CedarwoodOS stripping.
 * This stub exists to prevent import errors from files that still reference it.
 * All methods return safe defaults or throw appropriate errors.
 */

import { logger } from '../utils/logger';

class OpenPhoneServiceStub {
  async testConnection(): Promise<boolean> {
    return false;
  }

  async sendMessage(to: string, from: string, body: string, options?: any): Promise<any> {
    logger.warn('OpenPhone sendMessage called but service is removed', { to, bodyLength: body.length });
    throw new Error('OpenPhone integration has been removed');
  }

  async getUserByPhoneNumber(phoneNumber: string): Promise<any> {
    return null;
  }

  isConnected(): boolean {
    return false;
  }
}

export const openPhoneService = new OpenPhoneServiceStub();
export default openPhoneService;
