# import/

აქ `tools/add_post.py` ინახავს გამზადებული პოსტების ლოკალურ ასლს (posts.json + posts/*.jpg).
ეს საქაღალდე GitHub-ზე არ იტვირთება (.gitignore), ანუ ინტერნეტში არ ჩანს.
ბაზაში პოსტი თავისით იწერება (tools/fs_push.py, გასაღები .secrets/firebase_key.json), ღილაკი საჭირო არ არის.
ხელახლა ჩაწერა: `python tools/add_post.py sync`. გასუფთავება: `python tools/add_post.py clear`.
