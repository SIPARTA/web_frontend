import type { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Inisialisasi Gemini API di dalam handler untuk memastikan koneksi ke environment variable terbaru
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { message, history } = req.body;

    if (!message) {
      return res.status(400).json({ message: 'Message is required' });
    }

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.length < 10) {
      console.warn("[API/chat] GEMINI_API_KEY is not set or invalid.");
      return res.status(503).json({
        message: "Layanan AI belum tersedia. GEMINI_API_KEY belum dikonfigurasi pada server. Silakan hubungi administrator."
      });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: "Kamu adalah asisten keselamatan untuk SIPARTA, Sistem Pintar Deteksi Kimia Rumah Tangga. Jawab dalam bahasa Indonesia yang ringkas, praktis, dan mudah dipahami. Jangan melebih-lebihkan kemampuan sistem. Jika pengguna menyebut campuran berbahaya seperti pemutih dengan amonia atau cuka, beri peringatan jelas dan anjurkan ventilasi serta pemisahan bahan.",
    });

    const chat = model.startChat({
      history: history || [],
    });

    const result = await chat.sendMessage(message);
    const response = await result.response;
    const text = response.text();

    return res.status(200).json({ reply: text });
  } catch (error: unknown) {
    console.error('Error in chat route:', error);
    
    let errorMsg = 'Terjadi kesalahan saat menghubungi API Gemini.';
    if (error instanceof Error && error.message.includes('API key not valid')) {
      errorMsg = 'API Key Gemini Anda tidak valid. Silakan periksa kembali file .env.local Anda dan pastikan API Key (AIzaSy...) sudah lengkap dan benar tanpa spasi tambahan.';
    }
    
    return res.status(500).json({ message: errorMsg });
  }
}
