import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const platformParam = (searchParams.get('platform') || 'windows').toLowerCase();
  const isMac = platformParam === 'mac';

  const origin = new URL(req.url).origin;

  if (isMac) {
    const macScript = [
      '#!/bin/bash',
      'echo "Launching RestroSync POS Desktop Companion for macOS..."',
      `open "${origin}"`,
    ].join('\n');

    return new NextResponse(macScript, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream; charset=utf-8',
        'Content-Disposition': 'attachment; filename="RestroSync-POS-Mac.command"',
        'Cache-Control': 'no-store',
      },
    });
  }

  const windowsScript = [
    '@echo off',
    'echo Launching RestroSync POS Desktop Companion for Windows...',
    `start "" "${origin}"`,
  ].join('\r\n');

  return new NextResponse(windowsScript, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream; charset=utf-8',
      'Content-Disposition': 'attachment; filename="RestroSync-POS-Windows.bat"',
      'Cache-Control': 'no-store',
    },
  });
}