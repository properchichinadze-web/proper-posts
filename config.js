// ═══════════════════════════════════════════════════════════════════════
//  ახალი კომპანიისთვის მხოლოდ ეს ფაილი და logo.png იცვლება.
//  ყველა ხაზი, სადაც წერია TODO, ახალი კომპანიის მონაცემით უნდა შეიცვალოს.
// ═══════════════════════════════════════════════════════════════════════

// 1) Firebase. სანამ ცარიელია, საიტი სადემო რეჟიმშია (მონაცემები მხოლოდ ამ ბრაუზერში ინახება).
//    Firebase პროექტის შექმნის მერე აქ ჩაისმება Firebase console → Project settings → Your apps → Web → firebaseConfig.
//    ეს ვებ კონფიგურაცია საჯაროა, დაცვას firestore.rules აკეთებს.
export const firebaseConfig = {
  apiKey: 'AIzaSyCcAESbd5_VqBILvmbMEMeBY5tMfyqWk90',
  authDomain: 'proper-marketing.firebaseapp.com',
  projectId: 'proper-marketing',
  storageBucket: 'proper-marketing.firebasestorage.app',
  messagingSenderId: '343972245981',
  appId: '1:343972245981:web:d2c35678bc505df71d0634',
};

// 2) ბრენდი
export const BRAND = {
  name: 'პროპერი',
  nameGen: 'პროპერის',
  title: 'პროპერის მარკეტინგული სააგენტო',
  logo: 'logo.png',                         // თეთრი ლოგო (proper_dizaini/video/assets/template-დან)
  favLetter: 'P',
  colors: {                                 // proper_dizaini/STYLE.md
    primary: '#DE2A2F',                     //   წითელი
    dark: '#141416',                        //   მუქი (20, 20, 22)
    accent: '#FFCC00',                      //   ყვითელი (255, 204, 0)
  },
  shopLabel: 'ონლაინ მაღაზია',
  shopUrl: 'https://yato.ge/en',
  shopHost: 'yato.ge',
  loginDomain: 'proper.local',
  // ბრენდ მენეჯერის მიმართულებები: yato.ge-ს მთავარი გვერდის განყოფილებები
  cats: ['ხელის ინსტრუმენტები', 'ელექტრო ინსტრუმენტები', 'ელემენტით მომუშავე ხელსაწყოები', 'მაღალ ძაბვაზე მომუშავე ხელსაწყოები', 'სპეცტანსაცმელი'],
  // პროპერის 3 სტილი (CLAUDE.md, წესი №3)
  styles: {
    1: { name: 'კვირის აქცია', what: 'პოსტერი + რილსის ვიდეო, აქციის ფასით', need: 'პროდუქტის ლინკი yato.ge-ზე', link: 'shop' },
    2: { name: 'ჩვეულებრივი პოსტი', what: 'სეზონური პროდუქცია: პოსტერი + ვიდეო', need: 'პროდუქტის ლინკი yato.ge-ზე', link: 'shop' },
    3: { name: 'ჩვენი ვიდეო', what: 'ჩვენი გადაღებული ვიდეო, პროპერის ანიმაციებით', need: 'პროდუქტის ლინკი yato.ge-ზე', link: 'shop' },
  },
  postDays: [1, 3, 5],   // ორშაბათი, ოთხშაბათი, პარასკევი
  confirmHours: 3,
  storageKey: 'proper',
};
