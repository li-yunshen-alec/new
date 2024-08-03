// app/api/cloneAndProcess/route.js
import { NextResponse } from 'next/server';
import simpleGit from 'simple-git';
import { resolve } from 'path';
import { promises as fs } from 'fs';
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI('AIzaSyAEAh4mufNHAh_FiMwD_4nE8xng8Elll6w');

async function shouldProcessFolder(prompt) {
  // Extract the part of the path after 'tempRepo'
  const tempRepoIndex = prompt.indexOf('tempRepo');
  const modifiedPrompt = tempRepoIndex !== -1 ? prompt.substring(tempRepoIndex + 'tempRepo'.length + 1) : prompt;

  // List of folder names that are not relevant
  const irrelevantFolders = [
    'node_modules', 'public', '.vscode', '.git', 'dist', 'build', 'coverage', 'logs', 'temp', 'tmp', 'cache'
  ];

  // Check if modifiedPrompt contains any of the strings in irrelevantFolders
  for (const folder of irrelevantFolders) {
    if (modifiedPrompt.includes(folder)) {
      return false;
    }
  }

  return true;
}

const git = simpleGit();

async function* listFilesRecursive(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const path = resolve(dir, entry.name);

    if (entry.isDirectory()) {
      const shouldProcess = await shouldProcessFolder(path);
      if (shouldProcess) {
        yield* listFilesRecursive(path); // Recursive yield
      }
    } else {
      yield path;
    }
  }
}

function shouldProcessFile(filePath) {
  const irrelevantExtensions = ['.gitignore', '.css', '.md', '.log', '.json', '.lock', '.yml', '.yaml'];

  for (const ext of irrelevantExtensions) {
    if (filePath.endsWith(ext)) {
      return false;
    }
  }
  return true;
}

async function listFiles(dir) {
  const filePaths = [];
  for await (const filePath of listFilesRecursive(dir)) {
    if (shouldProcessFile(filePath)) {
      filePaths.push(filePath);
    }
  }
  return filePaths;
}

async function getCombinedFileContents(filePaths) {
  const combinedContent = [];
  combinedContent.push('Please summarize the following project based on the provided files and their content. The files are organized by name and content:');

  for (const filePath of filePaths) {
    const content = await fs.readFile(filePath, 'utf8');
    combinedContent.push(`\n--- File: ${filePath} ---\n${content}`);
  }

  return combinedContent.join('\n');
}

export async function POST(request) {
  try {
    const { repoUrl } = await request.json();
    const repoDir = resolve(process.cwd(), 'tempRepo');

    console.log('repoDir', repoDir);

    // Ensure the tempRepo directory is empty
    try {
      await fs.rm(repoDir, { recursive: true, force: true });
    } catch (error) {
      console.log('Error removing existing tempRepo directory:', error);
    }

    console.log('cloning...')

    // Clone the repository
    await git.clone(repoUrl, repoDir);    

    // List all files and folders recursively, skipping irrelevant directories and files
    const files = await listFiles(repoDir);

    // Get combined content of all relevant files
    const combinedContent = await getCombinedFileContents(files);

    console.log('combinedContent', combinedContent);
    
    const result = await run(combinedContent);

    console.log(result);

    // Clean up: remove the cloned repository
    await fs.rm(repoDir, { recursive: true, force: true });

    return NextResponse.json({ success: true, combinedContent });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

async function run(prompt) {
  // Choose a model that's appropriate for your use case.
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash"});

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();

  return text;
}
