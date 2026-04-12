const { GoogleGenAI } = require('@google/genai');
const { structuredLog } = require('./logger');

/**
 * Generic LLM service for generating text using Gemini API
 * Handles prompt execution, error handling, and fallbacks
 */
class LLMService {
  constructor() {
    this.defaultTimeout = 10000; // 10 seconds
    this.genAI = null;
    this.initialized = false;
  }

  /**
   * Initialize the Gemini AI client
   */
  async initialize() {
    if (this.initialized) return;

    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY environment variable not set');
      }

      this.genAI = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY
      });

      this.initialized = true;
      structuredLog.info('Gemini API initialized successfully');
      
    } catch (error) {
      structuredLog.error('Failed to initialize Gemini API', error);
      throw error;
    }
  }

  /**
   * Generate text using Gemini API
   * @param {string} prompt - The prompt to send to the LLM
   * @param {Object} options - Configuration options
   * @param {number} options.timeout - Timeout in milliseconds
   * @param {string} options.fallback - Fallback text if LLM fails
   * @param {number} options.maxTokens - Maximum output tokens (default 500)
   * @param {number} options.temperature - Temperature for randomness (default 0.9)
   * @returns {Promise<string>} Generated text or fallback
   */
  async generateText(prompt, options = {}) {
    const { timeout = this.defaultTimeout, fallback = null, maxTokens = 500, temperature = 0.9 } = options;

    try {
      // Initialize if not already done
      await this.initialize();

      structuredLog.info('LLM generation started', { 
        promptLength: prompt.length,
        timeout 
      });

      // Create the generation request using Google's API pattern
      const generationPromise = this.genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          generationConfig: {
            temperature: temperature,
            topP: 0.95,
            maxOutputTokens: maxTokens
          },
          thinkingConfig: {
            thinkingBudget: 0 // Disable thinking for faster response
          }
        }
      });

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), timeout)
      );

      const result = await Promise.race([generationPromise, timeoutPromise]);
      
      if (!result || !result.text) {
        throw new Error('No response from Gemini API');
      }

      const text = result.text;
      
      if (!text || text.trim().length === 0) {
        throw new Error('Empty response from LLM');
      }

      structuredLog.info('LLM generation successful', { 
        resultLength: text.length 
      });

      return text.trim();

    } catch (error) {
      structuredLog.error('LLM generation failed', error, {
        promptLength: prompt.length,
        hasFallback: !!fallback
      });

      if (fallback) {
        structuredLog.info('Using fallback text', { fallback });
        return fallback;
      }

      throw new Error(`LLM generation failed: ${error.message}`);
    }
  }

  /**
   * Test if Gemini API is available
   * @returns {Promise<boolean>} True if available
   */
  async isAvailable() {
    try {
      await this.initialize();
      return true;
    } catch (error) {
      structuredLog.warn('Gemini API not available', { error: error.message });
      return false;
    }
  }

  /**
   * Check API availability with detailed diagnostics
   * @returns {Promise<{available: boolean, checks: Object}>} Detailed availability info
   */
  async checkAvailability() {
    const checks = {
      apiKeySet: false,
      apiKeyValid: false,
      canInitialize: false,
      canCallAPI: false,
      error: null
    };

    // Step 1: Check if API key is set
    if (process.env.GEMINI_API_KEY) {
      checks.apiKeySet = true;
      checks.apiKeyValid = process.env.GEMINI_API_KEY.length > 10; // Basic validation
    } else {
      checks.error = 'GEMINI_API_KEY environment variable not set';
      return { available: false, checks };
    }

    // Step 2: Try to initialize
    try {
      await this.initialize();
      checks.canInitialize = true;
    } catch (error) {
      checks.error = `Initialization failed: ${error.message}`;
      return { available: false, checks };
    }

    // Step 3: Try a simple API call
    try {
      const testResult = await this.genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: "Test",
        config: {
          thinkingConfig: {
            thinkingBudget: 0
          }
        }
      });
      
      if (testResult && testResult.text) {
        checks.canCallAPI = true;
      } else {
        checks.error = 'API call succeeded but returned unexpected response format';
        return { available: false, checks };
      }
    } catch (error) {
      checks.error = `API call failed: ${error.message}`;
      return { available: false, checks };
    }

    return { available: true, checks };
  }

  /**
   * Generate text with automatic fallback handling
   * @param {string} prompt - The prompt to send
   * @param {string[]} fallbacks - Array of fallback options
   * @returns {Promise<string>} Generated text or random fallback
   */
  async generateWithFallbacks(prompt, fallbacks = []) {
    try {
      return await this.generateText(prompt);
    } catch (error) {
      if (fallbacks.length > 0) {
        const randomFallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
        structuredLog.info('Using random fallback', { fallback: randomFallback });
        return randomFallback;
      }
      throw error;
    }
  }
}

// Singleton instance
const llmService = new LLMService();

module.exports = {
  LLMService,
  llmService
};