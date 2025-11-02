// Simple test to check the browse API response
fetch('http://localhost:3000/api/mods/browse')
  .then(response => {
    console.log('Response status:', response.status);
    return response.json();
  })
  .then(data => {
    console.log('Response data type:', typeof data);
    console.log('Is array:', Array.isArray(data));
    console.log('Data length:', data.length);
    console.log('First item:', data[0]);
  })
  .catch(error => {
    console.error('Error:', error);
  });