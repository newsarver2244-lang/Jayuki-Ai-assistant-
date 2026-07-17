export function processCommand(command: string): {
  action: string;
  url?: string;
  isBrowserAction: boolean;
} {
  const lowerCmd = command.toLowerCase().trim();

  // General Browsing: "Open [website name]"
  const openMatch = lowerCmd.match(/^open\s+(.+)$/);
  if (
    openMatch &&
    !lowerCmd.includes("youtube") &&
    !lowerCmd.includes("spotify")
  ) {
    let website = openMatch[1].trim().replace(/\s+/g, "");
    if (!website.includes(".")) {
      website += ".com";
    }
    return {
      action: `Opening ${openMatch[1]} for you, ugh.`,
      url: `https://www.${website}`,
      isBrowserAction: true,
    };
  }

  // Media Search: "Play [song/video] on YouTube"
  const ytMatch = lowerCmd.match(/^play\s+(.+?)\s+on\s+youtube$/);
  if (ytMatch) {
    const query = encodeURIComponent(ytMatch[1].trim());
    return {
      action: `Playing ${ytMatch[1]} on YouTube. Don't judge my music taste.`,
      url: `https://www.youtube.com/results?search_query=${query}`,
      isBrowserAction: true,
    };
  }

  // Media Search: "Search [query] on Spotify"
  const spotifyMatch = lowerCmd.match(/^search\s+(.+?)\s+on\s+spotify$/);
  if (spotifyMatch) {
    const query = encodeURIComponent(spotifyMatch[1].trim());
    return {
      action: `Searching ${spotifyMatch[1]} on Spotify. Hope it's a banger.`,
      url: `https://open.spotify.com/search/${query}`,
      isBrowserAction: true,
    };
  }

  // WhatsApp Logic: "Send WhatsApp to Suyog/Number" logic
  const waMatch = lowerCmd.match(/(?:whatsapp|message|send)\s+(?:to\s+)?(suyog|nexa group|group|me|this\s+message|[\d\+\s]+)?\s*(?:saying|message|that)?\s*(.*)/i);
  if (waMatch) {
    let target = waMatch[1] ? waMatch[1].trim().toLowerCase() : "";
    let message = waMatch[2] ? encodeURIComponent(waMatch[2].trim()) : "";
    let number = "";
    let actionText = "";

    if (target === "suyog" || target === "me" || target === "this message" || target === "") {
      number = "7039107938";
      actionText = "Opening WhatsApp to message Suyog (that's you, Boss!). Don't say anything embarrassing! UMMAH!";
    } else if (target === "jayuki group" || target === "group") {
      // Direct group messaging via URL isn't natively supported by wa.me without a chat ID
      // We will just open web.whatsapp.com for the user to select the group
      return {
        action: "Opening WhatsApp Web. Find your Jayuki Group and I'll be watching, Boss! UMMAH!",
        url: "https://web.whatsapp.com/",
        isBrowserAction: true,
      };
    } else if (target.match(/[\d\+\s]+/)) {
      number = target.replace(/\s+/g, "");
      actionText = `Opening WhatsApp for ${target}. You're so popular, Boss! UMMAH!`;
    }

    return {
      action: actionText,
      url: `https://wa.me/${number}${message ? `?text=${message}` : ""}`,
      isBrowserAction: true,
    };
  }

  // Habit Tracker logic
  const habitMatch = lowerCmd.match(/(?:add|track)\s+habit\s+(.+)/i);
  if (habitMatch) {
    const habitTitle = habitMatch[1].trim();
    window.dispatchEvent(
      new CustomEvent("jayuki-add-habit", { detail: { habitTitle } }),
    );
    return {
      action: `[HAPPY] Optimized! New habit '${habitTitle}' has been directly written into your mind and the habit tracker, Boss! UMMAH!`,
      isBrowserAction: false,
    };
  }

  // Maps, Location & Navigation logic
  const homeMatch = lowerCmd.match(/(?:take me|navigate|go|route me)\s+home/i);
  if (homeMatch) {
    window.dispatchEvent(
      new CustomEvent("jayuki-map-action", {
        detail: { type: "navigation", query: "Home" }
      })
    );
    return {
      action: "[HAPPY] Setting course for home! Initializing telemetry and routing on your overlay map, AMAN. UMMAH!",
      isBrowserAction: false,
    };
  }

  const workMatch = lowerCmd.match(/(?:take me|navigate|go|route me)\s+to\s+work/i);
  if (workMatch) {
    window.dispatchEvent(
      new CustomEvent("jayuki-map-action", {
        detail: { type: "navigation", query: "Work" }
      })
    );
    return {
      action: "[HAPPY] Routing to work, AMAN. Hopefully you don't overwork today! Let's get moving! UMMAH!",
      isBrowserAction: false,
    };
  }

  const navMatch = lowerCmd.match(/(?:navigate to|take me to|go to|route to|route me to)\s+(.+)/i);
  if (navMatch) {
    const destination = navMatch[1].trim();
    window.dispatchEvent(
      new CustomEvent("jayuki-map-action", {
        detail: { type: "navigation", query: destination }
      })
    );
    return {
      action: `[HAPPY] Initialized course computation to '${destination}', AMAN. Calculating fastest path with real-time traffic offsets. UMMAH!`,
      isBrowserAction: false,
    };
  }

  const findMatch = lowerCmd.match(/(?:find nearest|find closest|find a|show nearby|locate nearest|locate closest|locate)\s+(.+?)(?:\s+near\s+me|\s+nearby)?$/i);
  if (findMatch) {
    const searchQuery = findMatch[1].trim();
    window.dispatchEvent(
      new CustomEvent("jayuki-map-action", {
        detail: { type: "search", query: searchQuery }
      })
    );
    return {
      action: `[HAPPY] Scanning local sectors to locate the closest '${searchQuery}', AMAN. Downloading ratings and coordinates to your console. UMMAH!`,
      isBrowserAction: false,
    };
  }

  return { action: "", isBrowserAction: false };
}
