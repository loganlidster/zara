import fs from 'fs';

const files = [
  'web-ui/src/pages/BatchDaily/BatchDaily.jsx',
  'web-ui/src/pages/FastDaily/FastDaily.jsx'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace localhost URLs with environment variable
  content = content.replace(
    /fetch\('http:\/\/localhost:3001\/api\/([\w-]+)',/g,
    "fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/$1`,"
  );
  
  fs.writeFileSync(file, content);
  console.log(`Updated ${file}`);
});

console.log('All files updated!');