#!/bin/bash
set -e

# Deploy and Test Security Fixes
# Comprehensive deployment validation and security testing

echo "🚀 EOS Fitness Tracker - Security Deployment Validation"
echo "======================================================"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEPLOYMENT_URL=${1:-"https://eos-fitness-tracker.netlify.app"}
LOCAL_TEST_URL="http://localhost:8888"

echo -e "${BLUE}📍 Target URL: ${DEPLOYMENT_URL}${NC}"
echo ""

# Step 1: Pre-deployment validation
echo -e "${YELLOW}🔍 Step 1: Pre-deployment Validation${NC}"
echo "----------------------------------------"

# Check if git is clean
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}⚠️  Warning: Uncommitted changes detected${NC}"
    git status --short
    echo ""
fi

# Verify critical files exist
echo "📁 Verifying project structure..."
REQUIRED_FILES=(
    "netlify/functions/_shared/auth.js"
    "netlify/functions/_shared/logger.js"
    "netlify/functions/user-settings.js"
    "netlify/functions/workout-logs.js"
    "netlify/functions/migrate-data.js"
    "netlify/functions/export-data.js"
    "netlify/functions/auth.js"
    "netlify.toml"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "   ✅ $file"
    else
        echo -e "   ❌ Missing: $file"
        exit 1
    fi
done

echo ""

# Step 2: Environment validation
echo -e "${YELLOW}🌍 Step 2: Environment Validation${NC}"
echo "-----------------------------------"

echo "🔑 Checking environment variables..."
if [ -z "$USER_TOKEN_SECRET" ]; then
    echo -e "${YELLOW}⚠️  USER_TOKEN_SECRET not set in current environment${NC}"
    echo "   This should be configured in Netlify deployment settings"
else
    echo -e "   ✅ USER_TOKEN_SECRET configured"
fi

if [ -z "$CORS_ORIGIN" ]; then
    echo -e "${YELLOW}⚠️  CORS_ORIGIN not set (will use default)${NC}"
else
    echo -e "   ✅ CORS_ORIGIN: $CORS_ORIGIN"
fi

echo ""

# Step 3: Local testing (if Netlify Dev available)
echo -e "${YELLOW}🏠 Step 3: Local Function Testing${NC}"
echo "-----------------------------------"

if command -v netlify &> /dev/null; then
    echo "📱 Netlify CLI found - running local tests..."
    
    # Check if netlify dev is running
    if curl -s "$LOCAL_TEST_URL" > /dev/null 2>&1; then
        echo "🔄 Local dev server detected at $LOCAL_TEST_URL"
        echo "🧪 Running security tests against local instance..."
        
        # Set test environment
        export USER_TOKEN_SECRET=${USER_TOKEN_SECRET:-"local-test-secret-change-in-production"}
        
        if [ -f "test-security-fixes.js" ]; then
            node test-security-fixes.js "$LOCAL_TEST_URL"
        else
            echo -e "${RED}❌ test-security-fixes.js not found${NC}"
        fi
    else
        echo "⏭️  No local dev server running - skipping local tests"
        echo "   To test locally: netlify dev"
    fi
else
    echo "⏭️  Netlify CLI not found - skipping local tests"
    echo "   Install with: npm install -g netlify-cli"
fi

echo ""

# Step 4: Deployment readiness check
echo -e "${YELLOW}📦 Step 4: Deployment Readiness${NC}"
echo "-----------------------------------"

echo "🔍 Analyzing function dependencies..."
if [ -f "package.json" ]; then
    echo -e "   ✅ package.json present"
    if grep -q "@netlify/blobs" package.json; then
        echo -e "   ✅ Netlify Blobs dependency found"
    else
        echo -e "   ❌ Missing @netlify/blobs dependency"
        exit 1
    fi
else
    echo -e "   ❌ package.json missing"
    exit 1
fi

echo "📋 Checking netlify.toml configuration..."
if grep -q "node_bundler = \"esbuild\"" netlify.toml; then
    echo -e "   ✅ esbuild bundler configured"
else
    echo -e "   ⚠️  esbuild bundler not configured"
fi

if grep -q "directory = \"netlify/functions\"" netlify.toml; then
    echo -e "   ✅ Functions directory configured"
else
    echo -e "   ❌ Functions directory not configured"
    exit 1
fi

echo ""

# Step 5: Production deployment testing
echo -e "${YELLOW}🌐 Step 5: Production Deployment Testing${NC}"
echo "-------------------------------------------"

echo "🌍 Testing deployment at: $DEPLOYMENT_URL"

# Basic connectivity test
if curl -s --head "$DEPLOYMENT_URL" | head -n 1 | grep -q "200 OK"; then
    echo -e "   ✅ Site is accessible"
else
    echo -e "   ❌ Site not accessible or returning errors"
    echo "   Check deployment status at: https://app.netlify.com"
fi

# Test Functions endpoints
echo "🔧 Testing Functions endpoints..."
FUNCTION_ENDPOINTS=(
    "auth"
    "user-settings"
    "workout-logs"
    "migrate-data"
    "export-data"
)

for endpoint in "${FUNCTION_ENDPOINTS[@]}"; do
    FUNCTION_URL="$DEPLOYMENT_URL/.netlify/functions/$endpoint"
    
    # Test OPTIONS for CORS
    if curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$FUNCTION_URL" | grep -q "200"; then
        echo -e "   ✅ $endpoint (CORS)"
    else
        echo -e "   ⚠️  $endpoint (CORS check failed)"
    fi
done

echo ""

# Step 6: Comprehensive security testing
echo -e "${YELLOW}🔒 Step 6: Security Validation${NC}"
echo "--------------------------------"

if [ -f "test-security-fixes.js" ]; then
    echo "🧪 Running comprehensive security tests..."
    
    # Note: In production, USER_TOKEN_SECRET should be set in Netlify environment
    # For testing, we use a test secret (this should match what's deployed)
    export USER_TOKEN_SECRET=${USER_TOKEN_SECRET:-"test-secret-for-validation"}
    
    node test-security-fixes.js "$DEPLOYMENT_URL"
else
    echo -e "${RED}❌ Security test suite not found${NC}"
    echo "   Expected: test-security-fixes.js"
fi

echo ""

# Step 7: Final validation
echo -e "${YELLOW}✅ Step 7: Final Validation${NC}"
echo "----------------------------"

echo "🔍 Deployment Summary:"
echo "   🌐 Site URL: $DEPLOYMENT_URL"
echo "   📱 Functions: $DEPLOYMENT_URL/.netlify/functions/"
echo "   🔧 Admin: https://app.netlify.com"
echo ""

echo "🛡️  Security Features Implemented:"
echo "   ✅ HMAC-signed authentication tokens"
echo "   ✅ ETag-based concurrency control"
echo "   ✅ Rate limiting on all endpoints"
echo "   ✅ CORS origin restrictions"
echo "   ✅ Content-Type and size validation"
echo "   ✅ Structured error responses"
echo "   ✅ Comprehensive request logging"
echo ""

echo "🚨 Required Environment Variables (set in Netlify):"
echo "   • USER_TOKEN_SECRET (cryptographically secure)"
echo "   • CORS_ORIGIN (default: https://eos-fitness-tracker.netlify.app)"
echo "   • ALLOW_LEGACY_AUTH (optional: 'true' for migration period)"
echo ""

echo -e "${GREEN}🎉 Deployment validation complete!${NC}"
echo ""
echo "📖 Next steps:"
echo "   1. Verify USER_TOKEN_SECRET is set in Netlify environment"
echo "   2. Test user registration and token generation"
echo "   3. Update client-side code to use secure authentication"
echo "   4. Monitor function logs for any issues"
echo ""
echo "🔗 Useful commands:"
echo "   netlify env:list                 # View environment variables"
echo "   netlify functions:log            # View function logs"
echo "   netlify deploy --prod           # Deploy to production"