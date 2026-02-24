import { useState, useRef } from 'react'
import Sidebar from '../components/Sidebar'
import { analyzeHealthData } from '../lib/gemini'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { Brain, Upload, X, Loader, AlertTriangle, CheckCircle, Info, Zap } from 'lucide-react'

const URGENCY_CONFIG = {
    Low: { cls: 'urgency-low', icon: CheckCircle, label: 'Low Urgency' },
    Medium: { cls: 'urgency-medium', icon: Info, label: 'Medium Urgency' },
    High: { cls: 'urgency-high', icon: AlertTriangle, label: 'High Urgency' },
    Emergency: { cls: 'urgency-emergency', icon: Zap, label: '⚠️ Emergency' },
}

export default function AIAssistant() {
    const { user } = useAuth()
    const [symptoms, setSymptoms] = useState('')
    const [imageFile, setImageFile] = useState(null)
    const [imagePreview, setImagePreview] = useState(null)
    const [imageBase64, setImageBase64] = useState(null)
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState(null)
    const [error, setError] = useState('')
    const [dragging, setDragging] = useState(false)
    const fileRef = useRef()

    function handleFile(file) {
        if (!file || !file.type.startsWith('image/')) return setError('Please upload a valid image file.')
        setImageFile(file)
        setImagePreview(URL.createObjectURL(file))
        const reader = new FileReader()
        reader.onload = (e) => {
            const base64 = e.target.result.split(',')[1]
            setImageBase64(base64)
        }
        reader.readAsDataURL(file)
        setError('')
    }

    function handleDrop(e) {
        e.preventDefault(); setDragging(false)
        handleFile(e.dataTransfer.files[0])
    }

    async function handleAnalyze(e) {
        e.preventDefault()
        if (!symptoms.trim() && !imageFile) return setError('Please enter symptoms or upload an image.')
        setLoading(true); setResult(null); setError('')

        const res = await analyzeHealthData(imageBase64, imageFile?.type, symptoms)
        setResult(res)

        // Save to Supabase
        if (user && res) {
            await supabase.from('ai_results').insert([{
                patient_id: user.id,
                symptoms,
                condition: res.condition,
                urgency: res.urgency,
                first_aid: res.firstAid,
                disclaimer: res.disclaimer,
            }])
        }
        setLoading(false)
    }

    function reset() {
        setResult(null); setSymptoms(''); setImageFile(null)
        setImagePreview(null); setImageBase64(null); setError('')
    }

    const urgency = result?.urgency || 'Low'
    const UConf = URGENCY_CONFIG[urgency] || URGENCY_CONFIG.Low
    const UIcon = UConf.icon

    return (
        <div className="dashboard-layout">
            <Sidebar />
            <main className="main-content">
                <div className="page-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: '#f3e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Brain size={24} color="#7c3aed" />
                        </div>
                        <div>
                            <h1 className="page-title">AI Health Assistant</h1>
                            <p className="page-subtitle">Upload a medical image and describe your symptoms for AI analysis</p>
                        </div>
                    </div>
                </div>

                <div className="page-content">
                    <div style={{ display: 'grid', gridTemplateColumns: result ? '1fr 1fr' : '1fr', gap: '1.5rem', maxWidth: result ? '100%' : 640, margin: '0 auto' }}>

                        {/* Input Form */}
                        <div className="card">
                            <div className="card-header">
                                <div className="card-title">Describe Your Symptoms</div>
                                <div className="card-subtitle">Be as detailed as possible for better accuracy</div>
                            </div>

                            {/* Image Upload */}
                            <div
                                className={`upload-zone ${dragging ? 'drag-over' : ''}`}
                                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                                onDragLeave={() => setDragging(false)}
                                onDrop={handleDrop}
                                onClick={() => !imagePreview && fileRef.current.click()}
                                style={{ marginBottom: '1.25rem', cursor: imagePreview ? 'default' : 'pointer' }}
                                id="image-upload-zone"
                            >
                                {imagePreview ? (
                                    <div style={{ position: 'relative', display: 'inline-block' }}>
                                        <img src={imagePreview} alt="Uploaded" />
                                        <button
                                            style={{ position: 'absolute', top: -8, right: -8, background: '#dc2626', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            onClick={e => { e.stopPropagation(); setImageFile(null); setImagePreview(null); setImageBase64(null) }}
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <Upload size={32} style={{ color: 'var(--gray-300)', marginBottom: '0.75rem' }} />
                                        <div style={{ fontWeight: 600, color: 'var(--gray-600)', marginBottom: '0.25rem' }}>Upload Medical Image</div>
                                        <div style={{ fontSize: '0.8125rem', color: 'var(--gray-400)' }}>Drag & drop or click · PNG, JPG, WEBP</div>
                                    </>
                                )}
                            </div>
                            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />

                            <form onSubmit={handleAnalyze} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Symptom Description</label>
                                    <textarea
                                        id="symptoms-input"
                                        className="form-textarea"
                                        placeholder="e.g., I have a severe headache for 2 days, with mild fever and neck stiffness. The pain worsens with bright light..."
                                        value={symptoms}
                                        onChange={e => { setSymptoms(e.target.value); setError('') }}
                                        rows={5}
                                    />
                                </div>
                                {error && <div className="auth-error">{error}</div>}
                                <div className="alert alert-info">
                                    <Info size={15} style={{ flexShrink: 0 }} />
                                    AI analysis is preliminary. Always consult a qualified doctor for medical decisions.
                                </div>
                                <button type="submit" className="btn btn-primary btn-lg" disabled={loading} id="analyze-btn">
                                    {loading ? <><Loader size={18} className="spin-icon" /> Analyzing...</> : <><Brain size={18} /> Analyze with AI</>}
                                </button>
                            </form>
                        </div>

                        {/* Result */}
                        {result && (
                            <div className="card" style={{ animation: 'slideUp 0.3s ease' }}>
                                <div className="card-header">
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div className="card-title">AI Analysis Result</div>
                                        <button className="btn btn-ghost btn-sm" onClick={reset}>New Check</button>
                                    </div>
                                </div>

                                {/* Urgency Badge */}
                                <div className={`badge ${UConf.cls}`} style={{ padding: '0.625rem 1rem', fontSize: '0.9375rem', marginBottom: '1.25rem', fontWeight: 700, display: 'flex', gap: '0.5rem', width: 'fit-content' }}>
                                    <UIcon size={16} /> {UConf.label}
                                </div>

                                {/* Condition */}
                                <div style={{ marginBottom: '1.25rem' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.375rem' }}>Possible Condition</div>
                                    <div style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--gray-900)' }}>{result.condition}</div>
                                </div>

                                {/* First Aid */}
                                {result.firstAid?.length > 0 && (
                                    <div style={{ marginBottom: '1.25rem' }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>Recommended First Aid</div>
                                        <ol style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {result.firstAid.map((step, i) => (
                                                <li key={i} style={{ fontSize: '0.9375rem', color: 'var(--gray-700)', lineHeight: 1.6 }}>{step}</li>
                                            ))}
                                        </ol>
                                    </div>
                                )}

                                {/* Disclaimer */}
                                {result.disclaimer && (
                                    <div className="alert alert-warning">
                                        <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                                        {result.disclaimer}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    )
}
