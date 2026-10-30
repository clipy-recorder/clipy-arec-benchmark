export function summarizeJsonl(jsonl) {
  const events = [];
  for (const line of jsonl.split('\n')) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      // Preserve malformed lines in the raw log.
    }
  }
  const completed = [...events].reverse().find((event) => event.type === 'turn.completed');
  const commandItems = events.filter((event) =>
    event.type === 'item.completed' && event.item?.type === 'command_execution');
  const toolItems = events.filter((event) =>
    event.type === 'item.completed' && event.item?.type && event.item.type !== 'agent_message');
  const commands = commandItems.map((event) => event.item.command ?? '').filter(Boolean);
  const rawVideoFrameInspection = commands.some((command) =>
    /(?:ffmpeg|ffprobe|python|open|qlmanage|view_image).*relay-design-review\.mp4/i.test(command));
  const rawAudioExtraction = commands.some((command) =>
    /(?:whisper|ffmpeg).*relay-design-review\.mp4/i.test(command)
      && /(?:audio|wav|mp3|transcrib|whisper|-vn)/i.test(command));
  return {
    eventCount: events.length,
    toolCallCount: toolItems.length,
    commandCallCount: commandItems.length,
    commands,
    usage: completed?.usage ?? null,
    modelTurnCompleted: Boolean(completed),
    rawCapability: {
      frameInspectionAttempted: rawVideoFrameInspection,
      audioExtractionAttempted: rawAudioExtraction,
    },
  };
}
