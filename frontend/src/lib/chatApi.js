export async function sendMessageToBot(message) {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    return data.reply || "Baik, saya catat pertanyaanmu.";
  } catch (e) {
    // Fallback mock jika backend belum tersedia
    return "(Mode offline) Terima kasih! Aku akan bantu. 🙂";
  }
}

