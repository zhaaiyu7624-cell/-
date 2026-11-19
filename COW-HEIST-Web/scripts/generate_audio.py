"""Render the original COW HEIST 2.2 score and sound effects.

Run with Python 3.12, NumPy and SciPy. Uses seeded synthesis only.
"""
from pathlib import Path
import wave

import numpy as np
from scipy.signal import butter, sosfilt

RATE = 44_100
TAU = 2 * np.pi
OUT = Path(__file__).resolve().parents[1] / "public" / "audio"


def time(seconds):
    return np.arange(round(seconds * RATE), dtype=np.float64) / RATE


def hz(note):
    return 440 * 2 ** ((note - 69) / 12)


def env(t, attack, decay, sustain=0, release=.08):
    """Finite envelope. Its release also limits transients at sample boundaries."""
    return (np.minimum(t / attack, 1)
            * (sustain + (1 - sustain) * np.exp(-t / decay))
            * np.clip((t[-1] - t) / release, 0, 1))


def shape_noise(t, rng, frequency, kind, boundary=False):
    signal = rng.standard_normal(t.size)
    if boundary:
        # Circular spectral shaping makes the noise bed periodic without a splice.
        bins = np.fft.rfftfreq(t.size, 1 / RATE)
        lo, hi = frequency
        gain = (bins / (bins + lo)) / (1 + (bins / hi) ** 2)
        return np.fft.irfft(np.fft.rfft(signal) * gain, t.size)
    return sosfilt(butter(2, frequency, btype=kind, fs=RATE, output='sos'), signal)


def add(track, signal, start, gain=1, pan=0):
    """Mix a voice, wrapping note tails into the next cycle."""
    position = round(start * RATE) % len(track)
    gains = np.array([np.sqrt((1 - pan) / 2), np.sqrt((1 + pan) / 2)]) * gain
    stereo = signal[:, None] * gains
    take = min(len(signal), len(track) - position)
    track[position:position + take] += stereo[:take]
    track[:len(signal) - take] += stereo[take:]


def bell(f, duration=1.35, brightness=1):
    t = time(duration)
    index = brightness * (1.07 * np.exp(-5.2 * t) + .12)
    return env(t, .008, .51, release=.22) * (
        np.sin(TAU * f*t + index*np.sin(TAU*2.01*f*t))
        + .27 * np.exp(-t*3.3) * np.sin(TAU*3.98*f*t)
        + .12 * np.exp(-t*7) * np.sin(TAU*6.87*f*t))


def bass(f, beat, tension):
    t = time(beat*.84)
    p = TAU*f*t
    woven = np.sin(p) + (.31 + tension*.15)*np.sin(2*p + .7*np.sin(.5*p))
    woven += .22*np.sin(3*p + 2*np.sin(TAU*2.2*t))
    return np.tanh(woven*(1 + tension*.44))*env(t, .014, beat*.38, .26, .09)


def drum(kind, rng, tension):
    t = time({'kick':.43, 'metal':.31, 'hat':.14}[kind])
    if kind == 'kick':
        phase = TAU*(46*t + 62*.034*(1 - np.exp(-t/.034)))
        y = np.tanh(1.32*np.sin(phase) + .22*np.sin(2*phase))*np.exp(-t*9)
        y += .21*shape_noise(t, rng, (720,3300), 'bandpass')*np.exp(-t*109)
    elif kind == 'metal':
        phase = TAU*(189*t + 70*.022*(1 - np.exp(-t/.022)))
        y = .42*np.sin(phase + 1.4*np.sin(2.71*phase))*np.exp(-t*17)
        y += .6*shape_noise(t, rng, (850,7800), 'bandpass')*np.exp(-t*(15+tension*2))
    else:
        y = shape_noise(t, rng, 6200, 'highpass')*np.exp(-t*31)
        y *= .73 + .27*np.cos(TAU*72*t)
    return y*env(t, .003, .7, .7, .04)


def glide(a, b, duration, depth=1, grit=0):
    t = time(duration)
    frequency = a*(b/a)**(t/duration)
    p = TAU*np.cumsum(frequency)/RATE
    y = np.sin(p + depth*np.sin(2.013*p) * np.exp(-2.6*t))
    y += .34*np.sin(.5*p) + grit*np.sin(4.17*p + TAU*37*t)
    return env(t, min(.035, duration*.23), duration*.7, .27, duration*.22)*np.tanh(y*(1+grit))


def rhythm(level, bar):
    patterns = [
        [(0,'kick'), (2.75,'metal')],
        [(0,'kick'), (1.75,'kick'), (2.5,'metal'), (3.25,'hat')],
        [(0,'kick'), (.75,'hat'), (1.5,'kick'), (2.25,'metal'), (2.75,'kick'), (3.5,'hat')],
        [(0,'kick'), (.5,'hat'), (1.25,'kick'), (1.75,'metal'), (2.5,'kick'), (3,'metal'), (3.5,'hat')],
    ]
    events = patterns[level-1].copy()
    if level >= 2 and bar % 4 in (2, 3):
        events.append((3.75 if bar % 4 == 2 else 3.125, 'metal'))
    if level == 4 and bar % 8 >= 4:
        events += [(1.875,'hat'),(2.875,'hat')]
    return events


def score(level):
    bpm, bars = [(72, 12), (78, 24), (96, 28), (116, 32), (136, 40)][level]
    beat = 60/bpm
    duration = bars*4*beat
    t = time(duration)
    full = len(t)/RATE
    rng = np.random.default_rng(2019 + level)
    mix = np.zeros((len(t),2), dtype=np.float32)
    root = 38
    motif = [0, 6, 3, 1, -2, 0]  # recurring D / tritone / minor-third signal
    positions = [0, .75, 1.5, 2.75, 3.125, 3.625]
    roots = [0, -2, 1, -4, 0, 3, -2, 1]
    tension = level/4

    # Phase closes on whole cycles. Independent modulation moves the drone and stereo pad.
    cycle = lambda frequency: TAU*round(frequency*full)*t/full
    modphase = TAU*t/full
    drone = (.63*np.sin(cycle(hz(root-12))) + .25*np.sin(cycle(hz(root)))
             + .11*np.sin(cycle(hz(root+6)))) * (.78+.16*np.cos(3*modphase)+.06*np.sin(7*modphase))
    atmospheric = shape_noise(t,rng,(42,1900),'bandpass',boundary=True)
    for channel, phase in enumerate((0, 1.3)):
        mix[:,channel] = .083*drone + (.017+.018*tension)*atmospheric*(.7+.3*np.sin(9*modphase+phase))
        mix[:,channel] += (.021+.012*tension)*np.sin(cycle(hz(62)+channel*.15)+.64*np.sin(5*modphase+phase))

    for bar in range(bars):
        s = 4*beat*bar
        phrase = bar % 8
        section = (bar // 4) % 3
        shift = roots[(bar//2) % len(roots)]
        # Staggered pad swells create chord changes above the common drone.
        if bar % 2 == 0:
            u = time(9*beat)
            chord = (0,3,6,13) if section!=1 else (0,1,7,10)
            for i, degree in enumerate(chord):
                p = TAU*hz(root+24+shift+degree)*u
                y = (np.sin(p+.27*np.sin(2.014*p))+.23*np.sin(2.003*p))
                y *= env(u, beat*1.2,beat*2.7,.45,beat*1.6)
                add(mix,y,s+i*.075,.019+i*.002,(-.63,-.22,.25,.66)[i])
        if level:
            for j,(offset,kind) in enumerate(rhythm(level,bar)):
                gain = {'kick':.24,'metal':.15,'hat':.069}[kind]
                add(mix,drum(kind,rng,tension),s+offset*beat,gain,0 if kind=='kick' else (-1)**j*.42)
            pulses = (0, 2.5) if level==1 else (0, 1.25, 2, 3.5) if level==2 else (0,.75,1.75,2.5,3.25)
            for j, offset in enumerate(pulses):
                note=root+shift-12+([0,0,6,3,-1][j] if section==2 else [0,0,7,0,1][j])
                add(mix,bass(hz(note),beat,tension),s+offset*beat,.173+tension*.05)
        # Sparse statements in the menu and L1 become fractured call-and-response.
        if phrase in (0, 3, 5, 7) or (level>=3 and phrase in (2, 6)):
            for k,(step,offset) in enumerate(zip(motif,positions)):
                if (level==0 and k in (1,4)) or (level==1 and k==4 and phrase%2):
                    continue
                transpose=shift+(12 if level>=3 and k==4 else 0)
                pitch=hz(root+31+step+transpose)
                strike=s+offset*beat+(beat*.08 if k in (2,4) else 0)
                pan=(-.54,.28,.12,.55,-.31,-.08)[k]
                voice=bell(pitch,1.29-.39*tension, .68+tension*1.45)
                add(mix,voice,strike,.089+.016*tension,pan)
                add(mix,voice,strike+.66*beat,.034,-pan)
                add(mix,voice,strike+1.32*beat,.016,pan)
        if bar%4 == 2 or (level>=3 and bar%4 == 0):
            signal=glide(hz(85+shift),hz(71+shift),.43,.9,.28*tension)
            add(mix,signal,s+2.375*beat,.038+.018*tension,.67*(-1)**bar)
            add(mix,signal,s+3.125*beat,.019,-.63)
        if phrase==7 or (level>=2 and phrase==3):
            u=time(beat*2.1)
            wash=shape_noise(u,rng,(270,4050),'bandpass')
            wash *= (u/u[-1])**2*env(u,.03,2,.8,.065)
            add(mix,wash,s+1.9*beat,.088+tension*.05,-.42)
        if level>=3 and (section==2 or phrase in (1,6)):
            for j in range(2 if level==3 else 4):
                y=glide(720+j*82,1090+j*173,.19,.9,.43)
                add(mix,y,s+(2.08+j*.37)*beat,.038+section*.012,(-1)**j*.7)
        if level==0 and bar%3==1:
            add(mix,drum('metal',rng,.1),s+2.9*beat,.045,-.55)
    # Circular stereo delays carry phrase tails over the loop boundary.
    for channel in range(2):
        wet=np.zeros(len(t),dtype=np.float32)
        for offset,gain in ((.071,.095),(.137,.063),(.229,.037),(.317,.021)):
            wet+=gain*np.roll(mix[:,1-channel],round(RATE*(offset+channel*.013)))
        mix[:,channel]+=wet
    return np.tanh(mix*(1.23+tension*.08))


def effect(name):
    rng=np.random.default_rng(5521)
    loop=name in ('ufo_beam_loop','cow_suction_loop')
    seconds={
        'ufo_start':.52,'ufo_beam_loop':2.,'cow_suction_loop':2.4,'cow_capture':.66,
        'golden_cow_capture':1.02,'obstacle_hit':.75,'combo_3':.75,'combo_5':1.04,
        'countdown':.30,'countdown_final':.70,'victory':2.28,'defeat':1.86,
        'ui_click':.105,'game_pause':.50,'game_resume':.50,
    }[name]
    t=time(seconds)
    out=np.zeros((len(t),2),dtype=np.float32)
    if loop:
        p=lambda f: TAU*round(f*seconds)*t/seconds
        bed=shape_noise(t,rng,(90,1580),'bandpass',boundary=True)
        body=(np.sin(p(53))+ .31*np.sin(p(106)+.72*np.sin(p(3)))) if name=='ufo_beam_loop' else (
            np.sin(p(79)+1.7*np.sin(p(4.5)))+.36*np.sin(p(157)+2.2*np.sin(p(7))))
        for channel,shift in enumerate((0,.8)):
            out[:,channel]=(.33*body*(.82+.18*np.sin(p(3)+shift))
                            + .10*bed*(.63+.37*np.cos(p(4.5)+shift)))
        return out
    parts=[]
    if name=='ufo_start':
        parts=[(0,glide(73,690,.49,2.2,.55),.72,0),(.035,glide(42,165,.28,1.4,.4),.39,-.26)]
    elif name in ('cow_capture','golden_cow_capture'):
        rare=name.startswith('golden')
        parts=[(0,glide(245,45,.28,1.8,.38),.73,0),(.09,bell(569,.39),.58,.22)]
        if rare:
            parts += [(.16+i*.105,bell(hz(note),.48,1.6),.48-i*.044,(-1)**i*.53)
                      for i,note in enumerate((79,85,88,91))]
    elif name=='obstacle_hit':
        impact=drum('kick',rng,1)
        clang=drum('metal',rng,1)
        parts=[(0,impact,.87,0),(0,clang,.86,-.48),(.032,glide(286,56,.47,2.3,.85),.71,.32),
               (.09,glide(913,662,.29,1.9,.78),.26,-.37),(.11,glide(1240,719,.25,1.44,.68),.22,.54)]
    elif name in ('combo_3','combo_5','victory'):
        notes={'combo_3':(66,72,77), 'combo_5':(66,72,77,82,89),
               'victory':(50,57,62,65,69,74,78,81)}[name]
        step=.157 if name=='victory' else .093
        parts=[(i*step,bell(hz(note),.43 if name!='victory' else .83,1.49),
                .55,(-1)**i*.42) for i,note in enumerate(notes)]
        if name=='victory':
            parts.extend((.92+i*.014,bell(hz(n),1.29,.92),.36,(-1)**i*.55)
                         for i,n in enumerate((50,62,65,69)))
    elif name=='defeat':
        parts=[(i*.19,glide(a,b,.74,2.2,.6),.52,(-1)**i*.38)
               for i,(a,b) in enumerate(((242,148),(174,98),(98,49)))]
        parts += [(.55,glide(72,27,1.28,.76,.43),.69,0)]
    elif name=='countdown':
        parts=[(0,bell(484,.25,.65),.76,0)]
    elif name=='countdown_final':
        parts=[(0,glide(118,47,.32,1.32,.32),.70,0),
               (.08,glide(725,632,.19,1.19,.33),.39,-.33),
               (.31,glide(835,620,.24,1.48,.42),.40,.35)]
    elif name=='ui_click':
        parts=[(0,glide(420,288,.09,.73,.3),.58,0)]
    elif name=='game_pause':
        parts=[(0,glide(345,145,.46,.91,.38),.57,-.18)]
    elif name=='game_resume':
        parts=[(0,glide(153,472,.46,.92,.38),.57,.18)]
    for at,y,gain,pan in parts:
        # SFX tails are clipped to the buffer and tapered rather than wrapping.
        y=y[:max(0,len(t)-round(at*RATE))].copy()
        n=min(round(.018*RATE),len(y))
        if n:y[-n:]*=np.linspace(1,0,n)
        add(out,y,at,gain,pan)
    return np.tanh(out)


SFX = (
    'ufo_start', 'ufo_beam_loop', 'cow_suction_loop', 'cow_capture', 'golden_cow_capture',
    'obstacle_hit', 'combo_3', 'combo_5', 'countdown', 'countdown_final', 'victory', 'defeat',
    'ui_click', 'game_pause', 'game_resume',
)


def save(path, audio, ceiling):
    path.parent.mkdir(parents=True,exist_ok=True)
    if path.parent.name=='bgm' or path.stem.endswith('_loop'):
        # Bring the two boundary samples to the same value with a 2 ms
        # cosine taper. The circular mix still carries its full texture.
        middle=(audio[0]+audio[-1])*.5
        weight=(.5+.5*np.cos(np.linspace(0,np.pi,round(RATE*.002))))[:,None]
        audio[:len(weight)] += weight*(middle-audio[0])
        audio[-len(weight):] += weight[::-1]*(middle-audio[-1])
    peak=float(np.max(np.abs(audio)))
    if peak>ceiling:
        audio*=ceiling/peak
    with wave.open(str(path),'wb') as writer:
        writer.setparams((2,2,RATE,0,'NONE','not compressed'))
        writer.writeframes(np.round(audio*32767).astype('<i2').tobytes())
    print(f'{path.name:27} {len(audio)/RATE:7.3f}s  {path.stat().st_size:>10,} bytes', flush=True)


def main():
    for level in range(5):
        name='bgm_menu' if level==0 else f'bgm_level_{level}'
        save(OUT/'bgm'/f'{name}.wav',score(level),.71)
    for name in SFX:
        save(OUT/'sfx'/f'{name}.wav',effect(name),.78)


if __name__=='__main__':
    main()
