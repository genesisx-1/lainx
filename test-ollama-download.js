#!/usr/bin/env node

/**
 * Test script to verify Ollama model download progress
 * Run this while Ollama server is running on localhost:11434
 */

const baseUrl = 'http://localhost:11434';
const modelName = 'qwen2.5:0.5b';

async function testModelDownload() {
  console.log(`\n🚀 Testing Ollama model download: ${modelName}\n`);
  console.log('Sending POST request to /api/pull with streaming...\n');

  try {
    const response = await fetch(`${baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: true })
    });

    if (!response.ok) {
      console.error(`❌ Request failed with status ${response.status}`);
      return;
    }

    console.log('✅ Connected, streaming progress...\n');

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let lastProgress = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value);
      const lines = text.split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          
          console.log('Raw JSON:', JSON.stringify(data, null, 2));
          
          // Check both lowercase and capital-case field names
          const total = data.total || data.Total;
          const completed = data.completed || data.Completed;
          
          if (total && completed) {
            const progress = Math.round((completed / total) * 100);
            if (progress !== lastProgress) {
              console.log(`📊 Progress: ${progress}% (${completed}/${total} bytes)`);
              lastProgress = progress;
            }
          }
          
          if (data.status) {
            console.log(`📌 Status: ${data.status}`);
            if (data.status === 'success') {
              console.log('\n✅ Download complete!\n');
            }
          }
        } catch (e) {
          console.error('Parse error:', e.message);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\nMake sure Ollama is running: ollama serve');
  }
}

testModelDownload();
