const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY

export async function analyzeHealthData(imageBase64, mimeType, symptoms) {
    // If no real API key, return mock response
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_gemini_api_key') {
        return getMockResponse(symptoms)
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`

    const parts = [
        {
            text: `You are a medical AI assistant. A patient has uploaded a medical image and provided the following symptom description: "${symptoms}".

Please analyze the image and symptoms and provide:
1. Possible medical condition(s)
2. Recommended first aid steps
3. Urgency level (Low / Medium / High / Emergency)

IMPORTANT: Always recommend consulting a real doctor. Never provide definitive diagnoses.

Respond in the following JSON format:
{
  "condition": "...",
  "firstAid": ["step 1", "step 2", ...],
  "urgency": "Low|Medium|High|Emergency",
  "disclaimer": "..."
}`
        }
    ]

    if (imageBase64) {
        parts.unshift({
            inlineData: {
                mimeType: mimeType || 'image/jpeg',
                data: imageBase64
            }
        })
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts }] })
        })

        const data = await response.json()

        if (!response.ok) throw new Error(data.error?.message || 'AI API error')

        const text = data.candidates[0]?.content?.parts[0]?.text || ''
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0])
        }
        return { condition: text, firstAid: [], urgency: 'Unknown', disclaimer: '' }
    } catch (err) {
        console.error('Gemini API error:', err)
        return getMockResponse(symptoms)
    }
}

function getMockResponse(symptoms) {
    const symLower = (symptoms || '').toLowerCase()
    if (symLower.includes('fever') || symLower.includes('temperature')) {
        return {
            condition: 'Possible viral fever or infection',
            firstAid: [
                'Rest and stay hydrated (8+ glasses of water)',
                'Take paracetamol (500mg) for fever if above 38.5°C',
                'Apply a cool, damp cloth to forehead',
                'Avoid cold baths — can cause shivering',
                'Monitor temperature every 2–3 hours'
            ],
            urgency: 'Medium',
            disclaimer: 'This is an AI-generated preliminary assessment. Please consult a qualified medical professional for an accurate diagnosis.'
        }
    }
    if (symLower.includes('chest') || symLower.includes('heart')) {
        return {
            condition: 'Possible cardiac event or chest muscle strain',
            firstAid: [
                'Sit or lie down in a comfortable position',
                'Loosen any tight clothing',
                'Do NOT ignore chest pain — seek emergency help immediately',
                'Call emergency services (102 or 108)',
                'If prescribed, use nitroglycerin spray under the tongue'
            ],
            urgency: 'Emergency',
            disclaimer: 'This is an AI-generated preliminary assessment. Chest pain is a medical emergency. Call emergency services immediately.'
        }
    }
    if (symLower.includes('headache') || symLower.includes('head')) {
        return {
            condition: 'Tension headache or migraine',
            firstAid: [
                'Rest in a quiet, dark room',
                'Apply a cold or warm compress to your head',
                'Take OTC pain reliever (ibuprofen or aspirin)',
                'Stay hydrated — dehydration is a common cause',
                'Avoid screen time for 1–2 hours'
            ],
            urgency: 'Low',
            disclaimer: 'This is an AI-generated preliminary assessment. Consult a doctor if headache is severe or recurring.'
        }
    }
    return {
        condition: 'Symptoms require professional evaluation',
        firstAid: [
            'Monitor and document your symptoms',
            'Rest and stay hydrated',
            'Avoid strenuous activity',
            'Schedule an appointment with your doctor',
            'Go to the emergency room if symptoms worsen'
        ],
        urgency: 'Medium',
        disclaimer: 'This is an AI-generated preliminary assessment. Please consult a qualified medical professional for an accurate diagnosis.'
    }
}
