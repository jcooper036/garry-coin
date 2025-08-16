const { db } = require('./db');
const { structuredLog } = require('./logger');

class ConnectionWarmer {
  constructor() {
    this.warmingInterval = null;
    this.isWarming = false;
    // Warm every 20 seconds (well within the 30s idle timeout)
    this.intervalMs = 20000;
  }

  async warmConnection() {
    if (this.isWarming) {
      return; // Prevent overlapping warm-ups
    }

    this.isWarming = true;
    try {
      const startTime = Date.now();
      
      // Simple, fast query to keep connections alive
      await db.raw('SELECT 1 as keepalive');
      
      const duration = Date.now() - startTime;
      structuredLog.database('Connection warmed successfully', { 
        duration,
        poolState: {
          used: db.client.pool.numUsed(),
          free: db.client.pool.numFree(),
          pending: db.client.pool.numPendingAcquires()
        }
      });
    } catch (error) {
      structuredLog.dbError('Connection warming failed', error, {
        poolState: {
          used: db.client.pool.numUsed(),
          free: db.client.pool.numFree(),
          pending: db.client.pool.numPendingAcquires()
        }
      });
    } finally {
      this.isWarming = false;
    }
  }

  start() {
    if (this.warmingInterval) {
      return; // Already started
    }

    structuredLog.database('Starting connection warmer', { 
      intervalMs: this.intervalMs 
    });

    // Do an initial warm-up
    this.warmConnection();

    // Set up regular warming
    this.warmingInterval = setInterval(() => {
      this.warmConnection();
    }, this.intervalMs);
  }

  stop() {
    if (this.warmingInterval) {
      clearInterval(this.warmingInterval);
      this.warmingInterval = null;
      structuredLog.database('Connection warmer stopped');
    }
  }

  // Get current pool metrics for monitoring
  getPoolMetrics() {
    const pool = db.client.pool;
    return {
      used: pool.numUsed(),
      free: pool.numFree(),
      pending: pool.numPendingAcquires(),
      total: pool.numUsed() + pool.numFree(),
      max: pool.max,
      min: pool.min
    };
  }

  // Check if pool is under stress (should trigger deferral)
  isPoolStressed() {
    const metrics = this.getPoolMetrics();
    // Pool is stressed if there are pending acquisitions or very few free connections
    return metrics.pending > 0 || metrics.free < 1;
  }
}

// Export singleton instance
module.exports = new ConnectionWarmer();