import numpy as np, os
from PIL import Image
from scipy import ndimage as nd
CLOSE={'sheet1_07':16,'sheet2_08':16,'sheet2_14':16,'music11_01':16,'music04_01':14}
out='/home/user/MofuMusic/assets/cats'
srcs=[('sheet1','1.jpg'),('sheet2','2.jpg'),('sheet3','3.jpg')]+[(f'music{i:02d}',f'pdfimg{i}.jpeg') for i in range(14)]
def cut(img,prefix,single):
    a=np.asarray(img.convert('RGB')).astype(int)
    H,W=a.shape[:2]
    fg=(a.min(axis=2)<215)
    m=nd.binary_dilation(fg,iterations=1)
    m=nd.binary_fill_holes(m)
    lab,k=nd.label(m)
    objs=nd.find_objects(lab)
    areas=nd.sum(m,lab,range(1,k+1))
    big=[i for i in range(k) if areas[i]>0.004*H*W]
    if single: big=[int(np.argmax(areas))]
    group={b:b for b in big}
    def dist(s,t):
        dy=max(0,s[0].start-t[0].stop,t[0].start-s[0].stop); dx=max(0,s[1].start-t[1].stop,t[1].start-s[1].stop)
        return max(dy,dx)
    for i in range(k):
        if i in group: continue
        d=[(dist(objs[i],objs[b]),b) for b in big]
        dd,b=min(d)
        lim = 10**9 if single else 12
        if dd<=lim: group[i]=b
    res=[]
    for b in big:
        members=[i for i,g in group.items() if g==b]
        comp=np.isin(lab,[i+1 for i in members])
        ys,xs=np.where(comp)
        res.append((ys.min(),ys.max(),xs.min(),xs.max(),comp))
    res.sort(key=lambda r:(r[0]//60, r[2]))
    for j,(y0,y1,x0,x1,comp) in enumerate(res):
        y0,y1,x0,x1=max(0,y0-3),min(H,y1+4),max(0,x0-3),min(W,x1+4)
        sub=a[y0:y1,x0:x1]; c=comp[y0:y1,x0:x1]
        f2=(sub.min(axis=2)<205)&c
        f2=np.pad(f2,20)
        cl=nd.binary_closing(f2,iterations=CLOSE.get(f'{prefix}_{j+1:02d}',5))
        cl=nd.binary_fill_holes(cl)[20:-20,20:-20]
        cl=nd.binary_opening(cl,iterations=1)
        alpha=nd.gaussian_filter(np.where(cl,255.,0.),0.6)
        rgba=np.dstack([sub.astype(np.uint8),np.clip(alpha,0,255).astype(np.uint8)])
        im=Image.fromarray(rgba,'RGBA'); im.thumbnail((320,320),Image.LANCZOS)
        fn=f'{out}/{prefix}_{j+1:02d}.png'; im.save(fn,optimize=True)
    print(prefix,len(res))
for p,f in srcs: cut(Image.open(f),p,p.startswith('music'))

SPLIT=['sheet1_10','sheet1_22','sheet1_25']
for nm in SPLIT:
    im=Image.open(f'{out}/{nm}.png'); A=np.asarray(im)
    w=A.shape[1]; col=A[:,:,3].astype(float).sum(0)
    lo,hi=int(w*.3),int(w*.7); x=lo+int(np.argmin(col[lo:hi]))
    os.remove(f'{out}/{nm}.png')
    for k,(a,b) in enumerate([(0,x),(x,w)]):
        p=Image.fromarray(A[:,a:b]); bb=p.getbbox(); p.crop(bb).save(f'{out}/{nm}{"ab"[k]}.png',optimize=True)
