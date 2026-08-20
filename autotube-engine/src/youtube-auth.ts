import { Logger } from '@nestjs/common';
import { google } from 'googleapis';
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { URL } from 'url';

const logger = new Logger('YouTubeAuth');
const REDIRECT_PORT = 53682;
const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}/oauth2callback`;
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics-monetary.readonly',
];

function loadDotEnv(): void {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    return;
  }
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq < 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

async function main(): Promise<void> {
  loadDotEnv();
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    logger.error('Definí GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en .env (cliente Desktop).');
    process.exit(1);
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });

  logger.log(`Agregá esta redirect URI en Google Cloud: ${REDIRECT_URI}`);
  logger.log('Scopes: youtube.upload + yt-analytics.readonly + youtube.readonly (+ monetary si Google lo concede).');
  logger.log('Si ya autorizaste solo upload, hay que reautorizar (prompt=consent).');
  logger.log(`Abrí este URL, autorizá el canal, y esperá el token:\n${authUrl}`);

  const code = await waitForCode();
  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token) {
    logger.error('Google no devolvió refresh_token. Revocá el acceso y reintentá con prompt=consent.');
    process.exit(1);
  }

  logger.log('Pegá esto en .env (no lo subas a git):');
  logger.log(`YOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}`);
}

function waitForCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url ?? '/', `http://127.0.0.1:${REDIRECT_PORT}`);
        if (url.pathname !== '/oauth2callback') {
          res.statusCode = 404;
          res.end('Not found');
          return;
        }
        const code = url.searchParams.get('code');
        const err = url.searchParams.get('error');
        if (err || !code) {
          res.statusCode = 400;
          res.end('Authorization failed. You can close this tab.');
          server.close();
          reject(new Error(err || 'missing code'));
          return;
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('OK. Volvé a la terminal y copiá YOUTUBE_REFRESH_TOKEN en .env.');
        server.close();
        resolve(code);
      } catch (error) {
        server.close();
        reject(error);
      }
    });
    server.listen(REDIRECT_PORT, '127.0.0.1');
  });
}

void main();
