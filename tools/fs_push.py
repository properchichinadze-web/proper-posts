"""
პოსტის პირდაპირ ჩაწერა საიტის დახურულ ბაზაში (Firestore `posts`), ღილაკის გარეშე.
გასაღები: <პროექტი>/.secrets/firebase_key.json (Firebase → Project settings → Service accounts →
„Generate new private key“; .secrets/ GitHub-ზე არ იტვირთება) ან გარემოს ცვლადი FIREBASE_KEY.
საჭიროა: pip install google-auth requests. საიტზე მარკეტინგის მიერ დანიშნული თარიღი/დრო/ტექსტი არ იშლება.
"""
import base64, json, os, time
from google.oauth2 import service_account
from google.auth.transport.requests import AuthorizedSession

KEY = os.environ.get("FIREBASE_KEY") or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".secrets", "firebase_key.json")
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = 'https://firestore.googleapis.com/v1/projects/{p}/databases/(default)/documents/posts/'


def _session():
    cred = service_account.Credentials.from_service_account_file(KEY, scopes=['https://www.googleapis.com/auth/datastore'])
    return AuthorizedSession(cred), json.load(open(KEY, encoding='utf-8'))['project_id']


def _enc(v):
    if v is None: return {'nullValue': None}
    if isinstance(v, bool): return {'booleanValue': v}
    if isinstance(v, int): return {'integerValue': str(v)}
    if isinstance(v, float): return {'doubleValue': v}
    if isinstance(v, str): return {'stringValue': v}
    if isinstance(v, list): return {'arrayValue': {'values': [_enc(x) for x in v]}}
    if isinstance(v, dict): return {'mapValue': {'fields': {k: _enc(x) for k, x in v.items()}}}
    raise TypeError(type(v))


def _dec(f):
    k, v = next(iter(f.items()))
    if k == 'nullValue': return None
    if k == 'integerValue': return int(v)
    if k == 'arrayValue': return [_dec(x) for x in v.get('values', [])]
    if k == 'mapValue': return {a: _dec(b) for a, b in v.get('fields', {}).items()}
    return v


def _data_url(src):
    if src.startswith('data:'): return src
    p = os.path.join(HERE, 'import', src)
    return 'data:image/jpeg;base64,' + base64.b64encode(open(p, 'rb').read()).decode()


def push(o):
    """o = ერთი პოსტი import/posts.json-დან. ბაზაში არსებულს ერწყმის (როგორც საიტის „იმპორტი“)."""
    s, proj = _session()
    pid = ''.join(c if c.isalnum() or c in '_-' else '_' for c in str(o['id']))
    url = BASE.format(p=proj) + pid
    r = s.get(url)
    old = {k: _dec(v) for k, v in r.json().get('fields', {}).items()} if r.status_code == 200 else {}
    imgs = [_data_url(x) for x in o.get('images') or []]
    doc = {
        'title': o.get('title') or old.get('title', ''),
        'text': o.get('text') or old.get('text', ''),
        'date': o.get('date') or old.get('date'),
        'time': (o.get('time') or '12:00') if o.get('date') else (old.get('time') or o.get('time') or '12:00'),
        'style': str(o.get('style') or old.get('style') or '1'),
        'where': o.get('where') or old.get('where', ''),
        'images': imgs or old.get('images', []),
        'links': o.get('links') or old.get('links', []),
        'videos': o.get('videos') or old.get('videos', []),
        'status': 'posted' if o.get('status') == 'posted' or old.get('status') == 'posted' else (o.get('status') or 'planned'),
        'productId': o.get('productId') or old.get('productId'),
        'updatedAt': int(time.time() * 1000),
    }
    r = s.patch(url, json={'fields': {k: _enc(v) for k, v in doc.items()}})
    if r.status_code != 200:
        raise SystemExit(f'ბაზაში ვერ ჩაიწერა ({r.status_code}): {r.text[:300]}')
    return pid, doc


def count():
    s, proj = _session()
    r = s.get(BASE.format(p=proj).rstrip('/'), params={'pageSize': 300, 'mask.fieldPaths': ['title', 'date', 'status']})
    return [(d['name'].rsplit('/', 1)[1], {k: _dec(v) for k, v in d.get('fields', {}).items()}) for d in r.json().get('documents', [])]
