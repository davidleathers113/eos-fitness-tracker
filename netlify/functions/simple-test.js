const { getStore, connectLambda } = require("@netlify/blobs");

exports.handler = async (event, context) => {
  // Initialize Netlify Blobs in Lambda compatibility (Functions API v1)
  connectLambda(event);
  console.log('Simple test function starting...');
  console.log('Event httpMethod:', event.httpMethod);
  console.log('Context keys:', Object.keys(context));
  
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    console.log('Creating store...');
    
    // Use the exact pattern from Netlify docs
    const uploads = getStore("simple-test");
    console.log('Store created successfully');

    console.log('Setting a test value...');
    await uploads.setJSON("test", { 
      message: "Hello from Netlify Blobs!",
      timestamp: new Date().toISOString()
    });
    console.log('Value set successfully');

    console.log('Getting the test value...');
    const result = await uploads.get("test", { type: 'json' });
    console.log('Value retrieved:', result);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Netlify Blobs test successful!',
        data: result
      })
    };

  } catch (error) {
    console.error('Error in simple test:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.name,
        message: error.message,
        context: {
          nodeVersion: process.version,
          functionName: context.functionName,
          awsRequestId: context.awsRequestId
        }
      })
    };
  }
};