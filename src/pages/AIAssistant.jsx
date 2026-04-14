import { useState, useRef } from 'react'
import Sidebar from '../components/Sidebar'
import { analyzeHealthData } from '../lib/gemini'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { Brain, Upload, X, Loader, AlertTriangle, CheckCircle, Info, Zap, Sparkles, ChevronRight } from 'lucide-react'

const URGENCY_CONFIG = {
    Low: { cls: 'badge-green', icon: CheckCircle, label: 'Standard Advisory' },
    Medium: { cls: 'badge-yellow', icon: Info, label: 'Elevated Precaution' },
    High: { cls: 'badge-red', icon: AlertTriangle, label: 'Urgent Clinical Review' },
    Emergency: { cls: 'urgency-emergency', icon: Zap, label: 'CRITICAL: Immediate Action' },
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
        if (!file || !file.type.startsWith('image/')) return setError('Please upload a valid clinical image.')
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
        if (!symptoms.trim() && !imageFile) return setError('Input diagnostics or medical imagery required.')
        setLoading(true); setResult(null); setError('')

        try {
            const res = await analyzeHealthData(imageBase64, imageFile?.type, symptoms)
            setResult(res)

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
        } catch (err) {
            setError('Diagnostic engine synchronization failed. Please retry.')
            console.error(err)
        } finally {
            setLoading(false)
        }
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
                    <div className="header-info">
                        <h1 className="page-title">Digital Health Assistant</h1>
                        <p className="page-subtitle">Pervasive AI diagnostic support and clinical imagery analysis</p>
                    </div>
                </div>

                <div className="page-content">
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: result ? '1.1fr 0.9fr' : '1fr', 
                        gap: '2.5rem', 
                        maxWidth: result ? '100%' : 720, 
                        margin: '0 auto',
                        alignItems: 'start'
                    }}>

                        {/* Analysis Interface */}
                        <div className="glass-panel section-container animate-fade-in" style={{ padding: '2.5rem' }}>
                            <div className="section-header">
                                <Sparkles size={20} className="text-secondary" />
                                <h2 className="section-title">Diagnostic Input</h2>
                            </div>

                            {/* Medical Imagery Upload */}
                            <div
                                className={`upload-zone-premium ${dragging ? 'drag-over' : ''}`}
                                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                                onDragLeave={() => setDragging(false)}
                                onDrop={handleDrop}
                                onClick={() => !imagePreview && fileRef.current.click()}
                                style={{ 
                                    marginBottom: '2rem', 
                                    cursor: imagePreview ? 'default' : 'pointer',
                                    height: imagePreview ? 'auto' : '200px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: 'rgba(255, 255, 255, 0.4)',
                                    borderRadius: '24px',
                                    border: dragging ? '2px dashed var(--secondary-color)' : '2px dashed var(--gray-200)',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    overflow: 'hidden',
                                    position: 'relative'
                                }}
                                id="image-upload-zone"
                            >
                                {imagePreview ? (
                                    <div style={{ padding: '1.25rem', width: '100%', textAlign: 'center' }}>
                                        <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
                                            <img 
                                                src={imagePreview} 
                                                alt="Preview" 
                                                style={{ 
                                                    maxHeight: '300px', 
                                                    borderRadius: '16px', 
                                                    boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                                                    border: '1px solid rgba(255,255,255,0.5)'
                                                }} 
                                            />
                                            <button
                                                style={{ 
                                                    position: 'absolute', top: -12, right: -12, 
                                                    background: 'var(--danger-color)', color: 'white', 
                                                    border: 'none', borderRadius: '50%', width: 32, height: 32, 
                                                    cursor: 'pointer', display: 'flex', alignItems: 'center', 
                                                    justifyContent: 'center', boxShadow: '0 8px 16px rgba(220, 38, 38, 0.3)',
                                                    transition: 'transform 0.2s ease'
                                                }}
                                                className="hover-scale"
                                                onClick={e => { e.stopPropagation(); setImageFile(null); setImagePreview(null); setImageBase64(null) }}
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                                        <div style={{ 
                                            width: 64, height: 64, borderRadius: '20px', 
                                            background: 'rgba(56, 189, 248, 0.1)', 
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                            margin: '0 auto 1.25rem'
                                        }}>
                                            <Upload size={28} className="text-secondary" />
                                        </div>
                                        <div style={{ fontWeight: 700, color: 'var(--gray-900)', fontSize: '1.125rem', marginBottom: '0.5rem' }}>Upload Reference Imagery</div>
                                        <div style={{ fontSize: '0.875rem', color: 'var(--gray-500)', maxWidth: '240px', margin: '0 auto' }}>Drage radiological or dermatological images for scan</div>
                                    </div>
                                )}
                            </div>
                            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />

                            <form onSubmit={handleAnalyze} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 700, fontSize: '0.9375rem' }}>Clinical Symptomatology</label>
                                    <textarea
                                        id="symptoms-input"
                                        className="form-input"
                                        placeholder="Describe symptom duration, intensity, and associated manifestations..."
                                        style={{ minHeight: '160px', padding: '1.25rem', fontSize: '1rem', lineHeight: 1.6 }}
                                        value={symptoms}
                                        onChange={e => { setSymptoms(e.target.value); setError('') }}
                                    />
                                </div>
                                
                                {error && <div className="alert alert-error" style={{ fontSize: '0.875rem' }}>{error}</div>}
                                
                                <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(56, 189, 248, 0.05)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <Info size={16} style={{ color: 'var(--secondary-color)', flexShrink: 0 }} />
                                    <p style={{ fontSize: '0.8125rem', color: 'var(--gray-600)', margin: 0 }}>This is an AI decision support tool. Official diagnosis requires a practitioner review.</p>
                                </div>

                                <button type="submit" className="btn btn-primary" style={{ height: '4rem', fontSize: '1.125rem' }} disabled={loading} id="analyze-btn">
                                    {loading ? (
                                        <><Loader size={22} className="spin" /> Synchronization in Progress...</>
                                    ) : (
                                        <><Brain size={22} /> Initiate Analysis</>
                                    )}
                                </button>
                            </form>
                        </div>

                        {/* Result Display */}
                        {result && (
                            <div className="glass-panel section-container animate-slide-up" style={{ padding: '2.5rem', background: 'rgba(255, 255, 255, 0.95)' }}>
                                <div className="section-header" style={{ marginBottom: '2rem' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>Clinical Summary</div>
                                        <h2 className="section-title" style={{ margin: 0 }}>Diagnostic Probabilities</h2>
                                    </div>
                                    <button className="btn btn-ghost btn-sm" onClick={reset}>Refresh</button>
                                </div>

                                {/* Urgency Status */}
                                <div style={{ marginBottom: '2.5rem' }}>
                                    <div className={`badge ${UConf.cls}`} style={{ 
                                        padding: '1rem 1.5rem', 
                                        fontSize: '1rem', 
                                        fontWeight: 800, 
                                        display: 'inline-flex', 
                                        alignItems: 'center', 
                                        gap: '0.75rem',
                                        borderRadius: '16px',
                                        boxShadow: '0 8px 24px rgba(0,0,0,0.05)'
                                    }}>
                                        <UIcon size={20} /> {UConf.label}
                                    </div>
                                </div>

                                {/* Findings */}
                                <div style={{ marginBottom: '2.5rem' }}>
                                    <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Primary Finding</div>
                                    <div style={{ 
                                        padding: '1.5rem', 
                                        background: 'var(--gray-50)', 
                                        borderRadius: '20px', 
                                        fontSize: '1.25rem', 
                                        fontWeight: 800, 
                                        color: 'var(--gray-900)',
                                        border: '1px solid var(--gray-100)'
                                    }}>
                                        {result.condition}
                                    </div>
                                </div>

                                {/* Care Protocol */}
                                {result.firstAid?.length > 0 && (
                                    <div style={{ marginBottom: '2.5rem' }}>
                                        <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1.25rem' }}>Immediate Care Protocol</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            {result.firstAid.map((step, i) => (
                                                <div key={i} style={{ 
                                                    display: 'flex', gap: '1rem', 
                                                    padding: '1.25rem', background: 'white', 
                                                    borderRadius: '16px', border: '1px solid var(--gray-50)',
                                                    boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
                                                }}>
                                                    <div style={{ 
                                                        width: 28, height: 28, borderRadius: '50%', 
                                                        background: 'var(--gray-900)', color: 'white', 
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                                        fontSize: '0.8125rem', fontWeight: 700, flexShrink: 0 
                                                    }}>
                                                        {i + 1}
                                                    </div>
                                                    <div style={{ fontSize: '0.9375rem', color: 'var(--gray-700)', lineHeight: 1.6, fontWeight: 500 }}>{step}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Critical Disclaimer */}
                                {result.disclaimer && (
                                    <div className="alert alert-warning" style={{ borderRadius: '20px', padding: '1.5rem', border: 'none', background: 'rgba(247, 183, 49, 0.1)' }}>
                                        <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
                                        <div style={{ fontSize: '0.875rem', lineHeight: 1.6, color: '#856404' }}>
                                            <span style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>Critical Caveat</span>
                                            {result.disclaimer}
                                        </div>
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

