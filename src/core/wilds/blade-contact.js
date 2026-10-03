const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const cross=(ax,az,bx,bz,cx,cz)=>(bx-ax)*(cz-az)-(bz-az)*(cx-ax);
function triangle(x,z,a,b,c) {
  if(Math.abs(cross(...a,...b,...c))<1e-10)return false;
  const ab=cross(...a,...b,x,z),bc=cross(...b,...c,x,z),ca=cross(...c,...a,x,z);
  return ab>=0&&bc>=0&&ca>=0 || ab<=0&&bc<=0&&ca<=0;
}
function nearSegment(x,z,a,b,radius) {
  const dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/Math.max(1e-12,dx*dx+dz*dz),0,1);
  return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t)<=radius;
}
export function bladeContact(row,from,to,x,z,radius) {
  if(to<row.hitStart || from>row.hitEnd)return false;
  const last=row.blade.length-1,start=clamp((from-row.hitStart)/(row.hitEnd-row.hitStart),0,1)*last,end=clamp((to-row.hitStart)/(row.hitEnd-row.hitStart),0,1)*last;
  const sample=t=>{const i=Math.min(last-1,Math.floor(t)),f=t-i;return row.blade[i].map((n,j)=>n+(row.blade[i+1][j]-n)*f);};
  let previous=sample(start),cursor=start;
  do {
    const nextTime=Math.min(end,Math.floor(cursor+1e-8)+1),next=sample(nextTime);
    const a=previous.slice(0,2),b=previous.slice(2),c=next.slice(2),d=next.slice(0,2);
    if(triangle(x,z,a,b,c)||triangle(x,z,a,c,d)||nearSegment(x,z,a,b,radius)||nearSegment(x,z,b,c,radius)||nearSegment(x,z,c,d,radius)||nearSegment(x,z,d,a,radius))return true;
    previous=next;cursor=nextTime;
  }while(cursor<end-1e-10);
  return false;
}
