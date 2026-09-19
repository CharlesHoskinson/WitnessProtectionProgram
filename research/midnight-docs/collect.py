"""Fetch bounded, commit-pinned official open-source documentation via Scrapling.
Do not crawl docs.midnight.network: its linked site terms prohibit extraction.
"""
from pathlib import Path
from datetime import datetime, timezone
import subprocess, hashlib, json, time
from scrapling.fetchers import Fetcher
ROOT=Path(__file__).resolve().parent
repo='midnight-docs';checkout='/home/charl/midnight/'+repo
commit='7cd3bc1681699b41d5a856f7ab2efd9892c27166'
paths=subprocess.check_output(['git','-C',checkout,'ls-tree','-r','--name-only',commit,'docs'],text=True).splitlines()
paths=[p for p in paths if p.endswith(('.md','.mdx')) and any(x in p for x in ['docs/compact/','docs/guides/','docs/tutorials/','docs/learn/','docs/concepts/'])]
paths=['LICENSE']+paths[:100]
# Include exact implementation sources defining the native formats.
source=json.loads((ROOT/'source-manifest.json').read_text())
requests=[(repo,commit,p) for p in paths]+[(x['repository'],x['commit'],x['path']) for x in source if x['repository']!=repo]
rows=[]
for repo,commit,path in requests:
 u=f'https://raw.githubusercontent.com/midnightntwrk/{repo}/{commit}/{path}'
 row={'url':u,'repository':repo,'commit':commit,'source_path':path,'retrieved_at':datetime.now(timezone.utc).isoformat()}
 try:
  r=Fetcher.get(u,timeout=30);row['http_status']=r.status
  if r.status==200:
   dest=ROOT/'official-source'/repo/path;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(r.body)
   row.update(status='ok',file=str(dest.relative_to(ROOT)),sha256=hashlib.sha256(r.body).hexdigest(),bytes=len(r.body))
  else:row['status']='http_error'
 except Exception as e:row.update(status='error',error=str(e)[:250])
 rows.append(row);(ROOT/'official-source-manifest.json').write_text(json.dumps(rows,indent=2)+'\n');time.sleep(.35)
print(json.dumps({'selected':len(requests),'ok':sum(r['status']=='ok' for r in rows)}))
