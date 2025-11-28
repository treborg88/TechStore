const http = require('http');

http.get('http://localhost:5001/api/products', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Response received, length:', data.length);
    try {
      const products = JSON.parse(data);
      console.log('Products count:', products.length);
      if (products.length > 0) {
        console.log('First product has images array:', Array.isArray(products[0].images));
        console.log('Images length:', products[0].images.length);
        console.log('First product:', JSON.stringify(products[0], null, 2));
      }
    } catch (e) {
      console.log('Parse error:', e.message);
    }
  });
}).on('error', (e) => console.log('Request error:', e.message));