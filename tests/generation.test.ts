import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { extractiveContent, generateContent } from '../server/generation';
import { defaultConfig } from '../src/api';

let server: Server;
let endpoint: string;
let requestBody: { model: string; messages: { role: string; content: string }[] };
let authorization: string | undefined;
let status = 200;
let output: string;
const source = 'A virtual private cloud isolates network resources in an account.\nIAM roles provide temporary credentials to applications and services.';
beforeAll(async () => {
  output = JSON.stringify({ ...extractiveContent(source), supplement: 'Model knowledge: always verify current service limits.' });
  server = createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    requestBody = JSON.parse(body);
    authorization = request.headers.authorization;
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ choices: [{ message: { content: output } }] }));
  }).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  endpoint = `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`;
});
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });

describe.sequential('OpenAI-compatible provider contract (local mock, no paid calls)', () => {
  it('sends source context and credentials without returning credentials in the study pack', async () => {
    const pack = await generateContent(source, 'Networking', { ...defaultConfig, provider: 'openai', baseUrl: endpoint, supplement: true }, 'test-key-not-a-secret', process.cwd());
    expect(authorization).toBe('Bearer test-key-not-a-secret');
    expect(requestBody.model).toBe('gpt-4o-mini');
    expect(requestBody.messages[1].content).toContain(source);
    expect(pack.supplement).toContain('Model knowledge');
    expect(pack.provider).toBe('openai');
    expect(JSON.stringify(pack)).not.toContain('test-key-not-a-secret');
    expect(pack.cards[0].schedule.reps).toBe(0);
  });
  it('supports model-knowledge topics and strips unrequested supplements', async () => {
    const pack = await generateContent('', 'VPC networking', { ...defaultConfig, provider: 'openai', baseUrl: endpoint }, undefined, process.cwd(), true);
    expect(requestBody.messages[1].content).toContain('Use your model knowledge');
    expect(pack.supplement).toBe('');
  });
  it('rejects invalid output instead of fabricating a successful pack', async () => {
    output = 'not JSON';
    await expect(generateContent(source, 'Networking', { ...defaultConfig, provider: 'openai', baseUrl: endpoint }, undefined, process.cwd())).rejects.toThrow('invalid JSON');
  });
  it('reports upstream quota/auth errors without exposing response contents', async () => {
    status = 429;
    await expect(generateContent(source, 'Networking', { ...defaultConfig, provider: 'openai', baseUrl: endpoint }, undefined, process.cwd())).rejects.toThrow('HTTP 429');
  });
});