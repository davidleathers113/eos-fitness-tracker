#!/usr/bin/env node
/**
 * Security Validation Test Suite
 * Comprehensive tests for all implemented security fixes
 * 
 * Run: node test-security-fixes.js [base-url]
 * Example: node test-security-fixes.js https://eos-fitness-tracker.netlify.app
 */

const crypto = require('crypto');

// Configuration
const BASE_URL = process.argv[2] || 'http://localhost:8888';
const TEST_SECRET = process.env.USER_TOKEN_SECRET || 'test-secret-for-validation';

console.log(`🔒 Testing security fixes against: ${BASE_URL}`);
console.log(`📊 Running comprehensive security validation...\n`);

// Test utilities
class SecurityTester {
  constructor(baseUrl, secret) {
    this.baseUrl = baseUrl;
    this.secret = secret;
    this.results = {
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  // Generate valid test token
  generateTestToken(userId = 'test-user-123') {
    const expiration = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 days
    const payload = JSON.stringify({ userId, exp: expiration });
    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(payload)
      .digest('hex');
    
    return Buffer.from(payload).toString('base64') + '.' + signature;
  }

  // Generate invalid token (wrong signature)
  generateInvalidToken(userId = 'test-user-123') {
    const expiration = Date.now() + (30 * 24 * 60 * 60 * 1000);
    const payload = JSON.stringify({ userId, exp: expiration });
    const wrongSignature = 'invalid-signature-' + crypto.randomBytes(32).toString('hex');
    
    return Buffer.from(payload).toString('base64') + '.' + wrongSignature;
  }

  async test(description, testFn) {
    try {
      console.log(`🧪 ${description}`);
      const result = await testFn();
      if (result.success) {
        console.log(`   ✅ PASS: ${result.message}\n`);
        this.results.passed++;
      } else {
        console.log(`   ❌ FAIL: ${result.message}\n`);
        this.results.failed++;
        this.results.errors.push({ test: description, error: result.message });
      }
    } catch (error) {
      console.log(`   💥 ERROR: ${error.message}\n`);
      this.results.failed++;
      this.results.errors.push({ test: description, error: error.message });
    }
  }

  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseUrl}/.netlify/functions/${endpoint}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    return {
      status: response.status,
      headers: response.headers,
      data: response.headers.get('content-type')?.includes('application/json') 
        ? await response.json() 
        : await response.text()
    };
  }

  // Test suite methods
  async testAuthentication() {
    await this.test('Valid token authentication', async () => {
      const token = this.generateTestToken();
      const response = await this.makeRequest('user-settings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.status === 200) {
        return { success: true, message: 'Valid token accepted' };
      } else {
        return { success: false, message: `Expected 200, got ${response.status}` };
      }
    });

    await this.test('Invalid token rejection', async () => {
      const invalidToken = this.generateInvalidToken();
      const response = await this.makeRequest('user-settings', {
        headers: { 'Authorization': `Bearer ${invalidToken}` }
      });
      
      if (response.status === 401) {
        return { success: true, message: 'Invalid token properly rejected' };
      } else {
        return { success: false, message: `Expected 401, got ${response.status}` };
      }
    });

    await this.test('Missing authentication rejection', async () => {
      const response = await this.makeRequest('user-settings');
      
      if (response.status === 401) {
        return { success: true, message: 'Unauthenticated request properly rejected' };
      } else {
        return { success: false, message: `Expected 401, got ${response.status}` };
      }
    });
  }

  async testRateLimiting() {
    await this.test('Rate limiting enforcement', async () => {
      const token = this.generateTestToken();
      const requests = [];
      
      // Make 35 rapid requests (limit is 30/minute)
      for (let i = 0; i < 35; i++) {
        requests.push(
          this.makeRequest('user-settings', {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        );
      }
      
      const responses = await Promise.all(requests);
      const rateLimited = responses.some(r => r.status === 429);
      
      if (rateLimited) {
        return { success: true, message: 'Rate limiting properly enforced' };
      } else {
        return { success: false, message: 'Rate limiting not enforced' };
      }
    });
  }

  async testCORS() {
    await this.test('CORS origin restrictions', async () => {
      const token = this.generateTestToken();
      const response = await this.makeRequest('user-settings', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Origin': 'https://malicious-site.com'
        }
      });
      
      const corsHeader = response.headers.get('access-control-allow-origin');
      if (corsHeader !== 'https://malicious-site.com' && corsHeader !== '*') {
        return { success: true, message: 'CORS properly restricted' };
      } else {
        return { success: false, message: `CORS too permissive: ${corsHeader}` };
      }
    });

    await this.test('Vary: Origin header present', async () => {
      const response = await this.makeRequest('user-settings', {
        method: 'OPTIONS'
      });
      
      const varyHeader = response.headers.get('vary');
      if (varyHeader && varyHeader.includes('Origin')) {
        return { success: true, message: 'Vary: Origin header present' };
      } else {
        return { success: false, message: `Missing Vary: Origin header` };
      }
    });
  }

  async testContentValidation() {
    await this.test('Content-Type validation', async () => {
      const token = this.generateTestToken();
      const response = await this.makeRequest('user-settings', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'text/plain'
        },
        body: 'invalid content type'
      });
      
      if (response.status === 400) {
        return { success: true, message: 'Content-Type validation working' };
      } else {
        return { success: false, message: `Expected 400, got ${response.status}` };
      }
    });

    await this.test('Body size limits', async () => {
      const token = this.generateTestToken();
      const largeBody = JSON.stringify({
        settings: {
          user: { name: "Test" },
          equipment_settings: {},
          data: 'x'.repeat(6 * 1024 * 1024) // 6MB (over 5MB limit)
        }
      });
      
      const response = await this.makeRequest('workout-logs', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: largeBody
      });
      
      if (response.status === 413) {
        return { success: true, message: 'Body size limits enforced' };
      } else {
        return { success: false, message: `Expected 413, got ${response.status}` };
      }
    });
  }

  async testErrorHandling() {
    await this.test('Structured error responses', async () => {
      const response = await this.makeRequest('user-settings');
      
      if (response.status === 401 && response.data.error) {
        return { success: true, message: 'Structured error format used' };
      } else {
        return { success: false, message: 'Non-standard error format' };
      }
    });

    await this.test('No sensitive data in errors', async () => {
      const response = await this.makeRequest('user-settings');
      const errorText = JSON.stringify(response.data).toLowerCase();
      
      const sensitiveTerms = ['secret', 'password', 'token', 'key', 'hmac'];
      const hasSensitiveData = sensitiveTerms.some(term => errorText.includes(term));
      
      if (!hasSensitiveData) {
        return { success: true, message: 'No sensitive data leaked in errors' };
      } else {
        return { success: false, message: 'Sensitive data found in error response' };
      }
    });
  }

  async testETags() {
    await this.test('ETag-based concurrency control', async () => {
      const token = this.generateTestToken();
      
      // Get current settings with ETag
      const getResponse = await this.makeRequest('user-settings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (getResponse.status !== 200 || !getResponse.data.etag) {
        return { success: false, message: 'Could not get ETag from response' };
      }
      
      // Try to update with wrong ETag
      const updateResponse = await this.makeRequest('user-settings', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          settings: {
            user: { name: "Updated" },
            equipment_settings: {}
          },
          ifMatch: 'wrong-etag-value'
        })
      });
      
      if (updateResponse.status === 409) {
        return { success: true, message: 'ETag mismatch properly detected (409 Conflict)' };
      } else {
        return { success: false, message: `Expected 409, got ${updateResponse.status}` };
      }
    });
  }

  async runAllTests() {
    console.log('🔐 AUTHENTICATION TESTS');
    await this.testAuthentication();
    
    console.log('⏱️  RATE LIMITING TESTS');
    await this.testRateLimiting();
    
    console.log('🌐 CORS TESTS');
    await this.testCORS();
    
    console.log('📝 CONTENT VALIDATION TESTS');
    await this.testContentValidation();
    
    console.log('🏷️  ETAG CONCURRENCY TESTS');
    await this.testETags();
    
    console.log('❌ ERROR HANDLING TESTS');
    await this.testErrorHandling();
    
    this.printSummary();
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 SECURITY TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`📈 Success Rate: ${((this.results.passed / (this.results.passed + this.results.failed)) * 100).toFixed(1)}%`);
    
    if (this.results.errors.length > 0) {
      console.log('\n🚨 FAILED TESTS:');
      this.results.errors.forEach(error => {
        console.log(`   • ${error.test}: ${error.error}`);
      });
    }
    
    if (this.results.failed === 0) {
      console.log('\n🎉 ALL SECURITY TESTS PASSED! System is production-ready.');
    } else {
      console.log('\n⚠️  Some tests failed. Review and fix before deployment.');
    }
  }
}

// Run tests
if (require.main === module) {
  const tester = new SecurityTester(BASE_URL, TEST_SECRET);
  tester.runAllTests().catch(console.error);
}

module.exports = SecurityTester;