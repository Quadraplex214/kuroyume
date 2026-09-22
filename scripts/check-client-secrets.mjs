import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
const secrets=['DATABASE_URL','TEST_DATABASE_URL','BETTER_AUTH_SECRET','RAPIDAPI_KEY','SMTP_URL'].map(key=>process.env[key]).filter(value=>value&&value.length>8);
async function files(path){return (await Promise.all((await readdir(path,{withFileTypes:true})).map(entry=>entry.isDirectory()?files(`${path}/${entry.name}`):[`${path}/${entry.name}`]))).flat();}
const scripts=(await files('.next/static')).filter(path=>path.endsWith('.js'));
if(!scripts.length)throw new Error('No production client bundles found. Run the build first.');
for(const path of scripts){const text=await readFile(path,'utf8');if(secrets.some(secret=>text.includes(secret)))throw new Error('A configured secret was detected in a client bundle. Values suppressed.');}
console.log(`Client secret scan passed (${scripts.length} JavaScript bundles checked).`);
