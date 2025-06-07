import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';

async function loadConfig() {
  const mcpPath = path.join(process.cwd(), '..', '.roo', 'mcp.json');
  const data = await fs.readFile(mcpPath, 'utf-8');
  const config = JSON.parse(data);
  return config.mcpServers?.['taskmaster-ai'];
}

function runCommand(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(stderr || error.message);
      } else {
        resolve(stdout);
      }
    });
  });
}

export default async function handler(req, res) {
  try {
    const server = await loadConfig();
    if (!server) throw new Error('taskmaster-ai not configured');
    const base = [server.command, ...server.args].join(' ');

    let output;
    if (req.method === 'GET') {
      if (req.query.id) {
        output = await runCommand(`${base} get_task ${req.query.id}`);
      } else {
        output = await runCommand(`${base} get_tasks`);
      }
    } else if (req.method === 'POST') {
      const { command } = req.body;
      output = await runCommand(`${base} ${command}`);
    } else {
      res.status(405).end();
      return;
    }
    res.status(200).json({ output });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
