const fs = require('fs');
const path = require('path');
const META = path.join(__dirname,'..','src','data','tool-metadata');
const files = fs.readdirSync(META).filter(f=>f.endsWith('.json'));
const thin = [];
files.forEach(f => {
  const m = JSON.parse(fs.readFileSync(path.join(META,f)));
  if (!m.snippet) thin.push(m.slug || f.replace('.json',''));
});
console.log('Tools missing snippet:', thin.length);
thin.forEach(s => console.log(' ', s));
