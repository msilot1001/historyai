import fs from 'node:fs';
const files=['styles.css','data.js','data.json','question-bank.js','original.pdf'];
fs.rmSync('dist',{recursive:true,force:true});
fs.mkdirSync('dist');
for(const file of files) fs.copyFileSync(file,`dist/${file}`);
fs.copyFileSync('app.js','dist/client.js');
fs.writeFileSync('dist/index.html',fs.readFileSync('index.html','utf8').replace('/app.js','/client.js'));
fs.cpSync('fonts','dist/fonts',{recursive:true});
console.log(`정적 배포 파일 ${files.length+2}개와 fonts 준비 완료`);
