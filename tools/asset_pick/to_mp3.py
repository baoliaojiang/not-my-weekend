import soundfile as sf, os, numpy as np
src=r'D:/workbuddy/2026-10-23-16-33-10/tools/asset_pick/music'
dst=r'D:/workbuddy/2026-10-23-16-33-10/assets/music'
sfx=r'D:/workbuddy/2026-10-23-16-33-10/assets/sfx'
os.makedirs(dst, exist_ok=True); os.makedirs(sfx, exist_ok=True)
m={'normalsociety':'title_normalsociety','plot_bgm_richang_01':'daily_richang','plot_bgm_calm_02':'calm','plot_bgm_silent_01':'silent','plot_bgm_girlfortherain':'rain','bluedaydream':'daydream'}
total=0
for s,o in m.items():
    p=os.path.join(src,s+'.wav')
    if not os.path.exists(p): print('MISS',s); continue
    data, sr = sf.read(p, dtype='float32')
    out=os.path.join(dst,o+'.mp3')
    sf.write(out, data, sr, format='MP3', subtype='MPEG_LAYER_III')
    sz=os.path.getsize(out); total+=sz
    print(f'{o}.mp3 {sz/1048576:.2f}MB')
print('music total %.1f MB'%(total/1048576))

# --- UI sfx (synthesized, public-domain style blips) ---
sr=44100
def env(n, a=0.005, d=0.12):
    t=np.linspace(0,1,n); 
    return np.minimum(t/a,1)*np.exp(-t/d)

def click(freq=1200, dur=0.05, amp=0.25):
    n=int(sr*dur); t=np.arange(n)/sr
    sig=np.sin(2*np.pi*freq*t)*0.6+np.sin(2*np.pi*freq*2.01*t)*0.2
    return (sig*env(n)*amp).astype('float32')

def page(dur=0.28, amp=0.35):
    n=int(sr*dur)
    rng=np.random.default_rng(7)
    noise=rng.normal(0,1,n)
    # simple bandpass-ish smoothing
    k=np.hanning(9); noise=np.convolve(noise,k/k.sum(),mode='same')
    e=np.exp(-np.linspace(0,6,n))
    return (noise*e*amp).astype('float32')

def blip(freq=660, dur=0.09, amp=0.18):
    n=int(sr*dur); t=np.arange(n)/sr
    sig=np.sin(2*np.pi*freq*t)+0.4*np.sin(2*np.pi*freq*1.5*t)
    return (sig*env(n,a=0.002,d=0.05)*amp).astype('float32')

for name, sig in [('click',click()),('page',page()),('notify',blip(880,0.12,0.16)),('select',blip(520,0.14,0.14))]:
    sf.write(os.path.join(sfx,name+'.wav'), sig, sr, format='WAV', subtype='PCM_16')
    print('sfx',name,'ok')
