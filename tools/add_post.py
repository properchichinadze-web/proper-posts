"""
გამზადებული პოსტის მომზადება საიტში ჩასაწერად (საიტის „გამზადებული პოსტები“ და კალენდარი).

ფაილები იწერება import/ საქაღალდეში (import/posts.json + import/posts/*.jpg, GitHub-ზე არ იტვირთება) და
პოსტი მაშინვე ჩაიწერება საიტის დახურულ ბაზაში (tools/fs_push.py, გასაღები .secrets/firebase_key.json).
ღილაკი არ არის: გუნდი პოსტს მაშინვე ხედავს. git push პოსტებისთვის საჭირო არ არის.

გამოყენება (პროექტის საქაღალდიდან):
  python tools/add_post.py add --id t10c --title "პოსტის სათაური" --text "D:/.../post.txt" \
      --img "D:/.../post.png" --img "D:/.../cover.png" --style 1 --where "Facebook, Instagram" \
      [--video "https://drive.google.com/file/d/<id>/view"] [--date 2026-11-20 --time 12:00] [--product <ბრენდ მენეჯერის პროდუქტის id>]
      (თარიღის გარეშე პოსტი „⚠ კალენდარში არ არის“ ჩანს; თარიღს მარკეტინგი საიტზე დანიშნავს)
  python tools/add_post.py posted --id t10c --link "Facebook=https://..." --link "Instagram=https://..."
      (დადების მერე: პოსტი ნაცრისფერი „✓ გამოქვეყნდა“ ხდება)
  python tools/add_post.py list       (რა არის ბაზაში)
  python tools/add_post.py sync [--id t10c]   (import/-დან ხელახლა ჩაწერა ბაზაში)
  python tools/add_post.py clear      (import/ საქაღალდის გასუფთავება)

id: მხოლოდ ლათინური ასოები, ციფრები, - და _ (ერთი პოსტი = ერთი id; იგივე id-ით ხელახლა იმპორტი პოსტს განაახლებს).
"""
import argparse, json, os, re, shutil, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fs_push import push, count

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMP = os.path.join(ROOT, 'import')
PJ = os.path.join(IMP, 'posts.json')
OUT = os.path.join(IMP, 'posts')


def load():
    return json.load(open(PJ, encoding='utf-8')) if os.path.exists(PJ) else []


def save(posts):
    os.makedirs(IMP, exist_ok=True)
    json.dump(posts, open(PJ, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


def shrink(src, name, w=900):
    os.makedirs(OUT, exist_ok=True)
    im = Image.open(src).convert('RGB')
    if im.width > w:
        im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    im.save(os.path.join(OUT, name), 'JPEG', quality=82, optimize=True)
    return 'posts/' + name   # საიტი ამას import/-ის მიმართ კითხულობს


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)
    a = sub.add_parser('add')
    a.add_argument('--id', required=True)
    a.add_argument('--title', required=True)
    a.add_argument('--text', help='ტექსტის ფაილი (UTF-8)')
    a.add_argument('--img', action='append', default=[])
    a.add_argument('--style', default='1')
    a.add_argument('--where', default='Facebook, Instagram')
    a.add_argument('--date')
    a.add_argument('--time', default='12:00')
    a.add_argument('--product')
    a.add_argument('--video', action='append', default=[], help='Drive-ის ვიდეოს ლინკი ან id (საიტზე Drive-ის ფლეერით ჩანს)')
    p = sub.add_parser('posted')
    p.add_argument('--id', required=True)
    p.add_argument('--link', action='append', default=[], help='ქსელი=ლინკი')
    sub.add_parser('list')
    sub.add_parser('clear')
    sy = sub.add_parser('sync')
    sy.add_argument('--id')
    x = ap.parse_args()

    if x.cmd == 'clear':
        shutil.rmtree(IMP, ignore_errors=True); os.makedirs(IMP, exist_ok=True)
        print('import/ გასუფთავდა'); return
    posts = load()
    if x.cmd == 'list':
        for pid, d in sorted(count(), key=lambda t: str(t[1].get('date'))):
            print(pid, d.get('date'), d.get('status'), d.get('title'))
        return
    if x.cmd == 'sync':
        for q in posts:
            if not x.id or q.get('id') == x.id:
                push(q); print('ბაზაში ჩაიწერა:', q.get('id'))
        return
    if x.cmd == 'add':
        if not all(c.isalnum() or c in '-_' for c in x.id) or not x.id.isascii():
            sys.exit('id: მხოლოდ ლათინური ასოები, ციფრები, - და _')
        text = open(x.text, encoding='utf-8').read().strip() if x.text else ''
        imgs = [shrink(src, f'{x.id}_{i + 1}.jpg') for i, src in enumerate(x.img)]
        entry = {'id': x.id, 'date': x.date, 'time': x.time, 'title': x.title, 'style': str(x.style), 'where': x.where,
                 'images': imgs, 'videos': [re.search(r'[-\w]{25,}', v).group(0) for v in x.video], 'text': text, 'status': 'planned', 'links': []}
        if x.product:
            entry['productId'] = x.product
        save([q for q in posts if q.get('id') != x.id] + [entry])
        push(entry)
        print('ბაზაში ჩაიწერა (გუნდი უკვე ხედავს):', x.id); return
    if x.cmd == 'posted':
        found = [q for q in posts if q.get('id') == x.id]
        q = found[0] if found else {'id': x.id, 'images': []}
        if not found:
            posts.append(q)
        q['status'] = 'posted'
        q['links'] = [{'network': l.split('=', 1)[0], 'url': l.split('=', 1)[1]} for l in x.link]
        save(posts)
        push(q)
        print('გამოქვეყნდა და ბაზაში ჩაიწერა:', x.id)


if __name__ == '__main__':
    main()
