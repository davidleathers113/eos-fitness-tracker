const { getStore, connectLambda } = require("@netlify/blobs");

exports.handler = async (event, context) => {
  // Initialize Netlify Blobs in Lambda compatibility (Functions API v1)
  connectLambda(event);
  console.log('Test function starting...');
  console.log('Event:', JSON.stringify(event, null, 2));
  console.log('Context:', JSON.stringify(context, null, 2));
  
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
    console.log('Attempting to get store...');
    const testStore = getStore("test-store");
    console.log('Store created successfully:', testStore);

    console.log('Attempting to set a test value...');
    const result = await testStore.set("test-key", "test-value-" + Date.now());
    console.log('Set result:', result);

    console.log('Attempting to get the test value...');
    const value = await testStore.get("test-key");
    console.log('Get result:', value);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Blobs test successful',
        setValue: "test-value-" + Date.now(),
        getValue: value,
        setResult: result
      })
    };

  } catch (error) {
    console.error('Error in test function:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Test failed',
        message: error.message,
        stack: error.stack,
        eventInfo: {
          httpMethod: event.httpMethod,
          headers: event.headers,
          path: event.path
        }
      })
    };
  }
};