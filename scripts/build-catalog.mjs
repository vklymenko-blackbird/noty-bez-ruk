// Build script for src/sources/catalog.json.
// Run once by hand: node scripts/build-catalog.mjs
// Flag --check: HEAD request for each resolved fileUrl, prints the dead ones.
// This script is not part of the app build.
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'src', 'sources', 'catalog.json');
const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'noty-bez-ruk-catalog/0.1 (build script)';
const DELAY_MS = 400;
const MIN_BYTES = 30 * 1024;
const MAX_BYTES = 12 * 1024 * 1024;
const MAX_PAGES_PREFERRED = 40;
const EXCLUDED = ['orchestra', 'violin', 'cello', 'flute', 'clarinet', 'guitar', 'organ', 'voice', 'choir', 'parts', 'manuscript', 'autograph', 'sketch', 'arr'];

// Curated list, most popular first. Fields query, must and surname are build-only.
// must: tokens that must all appear as whole words in the Commons file title.
const CURATED = [
  { id: 'beethoven-fur-elise', title: 'Für Elise', titleUk: 'До Елізи', aliases: ['Fur Elise', 'For Elise', 'Bagatelle No. 25', 'Елізі'], composer: 'Ludwig van Beethoven', composerUk: 'Людвіг ван Бетховен', detail: 'WoO 59', surname: 'Beethoven', query: 'Beethoven Fur Elise WoO 59', must: ['elise'] },
  { id: 'beethoven-moonlight', title: 'Moonlight Sonata', titleUk: 'Місячна соната', aliases: ['Moonlight Sonata', 'Mondscheinsonate', 'Sonata quasi una fantasia', 'Місячна', 'Місячна соната'], composer: 'Ludwig van Beethoven', composerUk: 'Людвіг ван Бетховен', detail: 'Op. 27 No. 2', surname: 'Beethoven', query: 'Beethoven Sonata No.14 Op.27 No.2', must: ['27', '2'] },
  { id: 'debussy-clair-de-lune', title: 'Clair de lune', titleUk: 'Місячне світло', aliases: ['Clair de Lune', 'Moonlight'], composer: 'Claude Debussy', composerUk: 'Клод Дебюссі', detail: 'from Suite bergamasque', surname: 'Debussy', query: 'Debussy Clair de lune piano', must: ['clair', 'lune'] },
  { id: 'chopin-minute-waltz', title: 'Waltz in D-flat major, Op. 64 No. 1 «Minute»', titleUk: 'Вальс ре-бемоль мажор «Хвилинний»', aliases: ['Minute Waltz', 'Waltz Op.64 No.1', 'Минутный вальс'], composer: 'Frédéric Chopin', composerUk: 'Фредерік Шопен', detail: 'Op. 64 No. 1', surname: 'Chopin', query: 'Chopin Waltz Op.64 No.1', must: ['64', '1'] },
  { id: 'liszt-liebestraum-3', title: 'Liebestraum No. 3', titleUk: 'Мрія № 3', aliases: ['Liebestraum', 'Love Dream No. 3', 'Liebesträume No. 3'], composer: 'Franz Liszt', composerUk: 'Ференц Ліст', detail: 'S. 541 No. 3', surname: 'Liszt', query: 'Liszt Liebestraum No.3', must: ['liebestraum', '3'] },
  { id: 'satie-gymnopedie-1', title: 'Gymnopédie No. 1', titleUk: 'Гімнопедія № 1', aliases: ['Gymnopedie No. 1', 'Gymnopedie 1'], composer: 'Erik Satie', composerUk: 'Ерік Саті', detail: 'Gymnopédie No. 1', surname: 'Satie', query: 'Satie Gymnopedie No.1', must: ['gymnopedie', '1'] },
  { id: 'mozart-rondo-alla-turca', title: 'Rondo alla Turca', titleUk: 'Рондо в турецькому стилі', aliases: ['Turkish March', 'Alla Turca', 'Турецький марш'], composer: 'Wolfgang Amadeus Mozart', composerUk: 'Вольфганг Амадей Моцарт', detail: 'K. 331', surname: 'Mozart', query: 'Mozart Rondo alla Turca K.331', must: ['331'] },
  { id: 'schumann-traumerei', title: 'Träumerei', titleUk: 'Мрійливість', aliases: ['Traumerei', 'Dreaming', 'Kinderszenen Op. 15 No. 7'], composer: 'Robert Schumann', composerUk: 'Роберт Шуман', detail: 'Op. 15 No. 7', surname: 'Schumann', query: 'Schumann Traumerei Kinderszenen', must: ['traumerei'] },
  { id: 'beethoven-pathetique', title: 'Pathétique Sonata', titleUk: 'Соната «Патетична»', aliases: ['Pathetique Sonata', 'Sonata Pathetique', 'Патетична соната'], composer: 'Ludwig van Beethoven', composerUk: 'Людвіг ван Бетховен', detail: 'Op. 13', surname: 'Beethoven', query: 'Beethoven Sonata Pathetique Op.13', must: ['pathetique'] },
  { id: 'bach-prelude-c-bwv846', title: 'Prelude in C major, BWV 846', titleUk: 'Прелюдія до мажор, BWV 846', aliases: ['Prelude in C major', 'Well-Tempered Clavier Book I Prelude 1', 'BWV 846'], composer: 'Johann Sebastian Bach', composerUk: 'Йоганн Себастьян Бах', detail: 'BWV 846', surname: 'Bach', query: 'Bach Prelude C major BWV 846', must: ['846'] },
  { id: 'beethoven-appassionata', title: 'Appassionata Sonata', titleUk: 'Соната «Аппассіоната»', aliases: ['Appassionata', 'Apassionata', 'Appassionata Sonata', 'Апасіоната'], composer: 'Ludwig van Beethoven', composerUk: 'Людвіг ван Бетховен', detail: 'Op. 57', surname: 'Beethoven', query: 'Beethoven Appassionata Op.57', must: ['appassionata'] },
  { id: 'chopin-nocturne-op9-2', title: 'Nocturne in E-flat major, Op. 9 No. 2', titleUk: 'Ноктюрн мі-бемоль мажор, соч. 9 № 2', aliases: ['Nocturne Op.9 No.2', 'Nocturne Op. 9 No. 2'], composer: 'Frédéric Chopin', composerUk: 'Фредерік Шопен', detail: 'Op. 9 No. 2', surname: 'Chopin', query: 'Chopin Nocturne Op.9 No.2', must: ['9', '2'] },
  { id: 'chopin-raindrop', title: 'Prelude in D-flat major, Op. 28 No. 15 «Raindrop»', titleUk: 'Прелюдія ре-бемоль мажор «Крапля»', aliases: ['Raindrop Prelude', 'Raindrop', 'Прелюдія Крапля'], composer: 'Frédéric Chopin', composerUk: 'Фредерік Шопен', detail: 'Op. 28 No. 15', surname: 'Chopin', query: 'Chopin Prelude Op.28 No.15 Raindrop', must: ['28', '15'] },
  { id: 'chopin-fantaisie-impromptu', title: 'Fantaisie-Impromptu in C-sharp minor, Op. 66', titleUk: 'Фантазія-експромт до-дієз мінор, соч. 66', aliases: ['Fantasie Impromptu', 'Fantaisie Impromptu', 'Fantasy Impromptu'], composer: 'Frédéric Chopin', composerUk: 'Фредерік Шопен', detail: 'Op. 66', surname: 'Chopin', query: 'Chopin Fantaisie-Impromptu Op.66', must: ['66'] },
  { id: 'chopin-etude-op10-3', title: 'Étude in E major, Op. 10 No. 3', titleUk: 'Етюд мі мажор, соч. 10 № 3', aliases: ['Etude Op. 10 No. 3', 'Tristesse', 'Тристесс'], composer: 'Frédéric Chopin', composerUk: 'Фредерік Шопен', detail: 'Op. 10 No. 3', surname: 'Chopin', query: 'Chopin Etude Op.10 No.3', must: ['10', '3'] },
  { id: 'chopin-etude-op10-12', title: 'Étude in C minor, Op. 10 No. 12 «Revolutionary»', titleUk: 'Етюд до мінор «Революційний»', aliases: ['Revolutionary Etude', 'Etude Op. 10 No. 12'], composer: 'Frédéric Chopin', composerUk: 'Фредерік Шопен', detail: 'Op. 10 No. 12', surname: 'Chopin', query: 'Chopin Etude Op.10 No.12', must: ['10', '12'] },
  { id: 'chopin-ballade-1', title: 'Ballade No. 1 in G minor, Op. 23', titleUk: 'Балада № 1 соль мінор, соч. 23', aliases: ['Ballade No. 1', 'Ballade 1'], composer: 'Frédéric Chopin', composerUk: 'Фредерік Шопен', detail: 'Op. 23', surname: 'Chopin', query: 'Chopin Ballade No.1 Op.23', must: ['23'] },
  { id: 'chopin-prelude-op28-4', title: 'Prelude in E minor, Op. 28 No. 4', titleUk: 'Прелюдія мі мінор, соч. 28 № 4', aliases: ['Prelude Op. 28 No. 4'], composer: 'Frédéric Chopin', composerUk: 'Фредерік Шопен', detail: 'Op. 28 No. 4', surname: 'Chopin', query: 'Chopin Prelude Op.28 No.4', must: ['28', '4'] },
  { id: 'chopin-prelude-op28-7', title: 'Prelude in A major, Op. 28 No. 7', titleUk: 'Прелюдія ля мажор, соч. 28 № 7', aliases: ['Prelude Op. 28 No. 7'], composer: 'Frédéric Chopin', composerUk: 'Фредерік Шопен', detail: 'Op. 28 No. 7', surname: 'Chopin', query: 'Chopin Prelude Op.28 No.7', must: ['28', '7'] },
  { id: 'chopin-prelude-op28-20', title: 'Prelude in C minor, Op. 28 No. 20', titleUk: 'Прелюдія до мінор, соч. 28 № 20', aliases: ['Prelude Op. 28 No. 20'], composer: 'Frédéric Chopin', composerUk: 'Фредерік Шопен', detail: 'Op. 28 No. 20', surname: 'Chopin', query: 'Chopin Prelude Op.28 No.20', must: ['28', '20'] },
  { id: 'chopin-waltz-op64-2', title: 'Waltz in C-sharp minor, Op. 64 No. 2', titleUk: 'Вальс до-дієз мінор, соч. 64 № 2', aliases: ['Waltz Op.64 No.2'], composer: 'Frédéric Chopin', composerUk: 'Фредерік Шопен', detail: 'Op. 64 No. 2', surname: 'Chopin', query: 'Chopin Waltz Op.64 No.2', must: ['64', '2'] },
  { id: 'chopin-waltz-a-minor', title: 'Waltz in A minor, B. 150', titleUk: 'Вальс ля мінор, B. 150', aliases: ['Waltz in A minor', 'Waltz Posthumous'], composer: 'Frédéric Chopin', composerUk: 'Фредерік Шопен', detail: 'B. 150', surname: 'Chopin', query: 'Chopin Waltz A minor B.150', must: ['150'] },
  { id: 'chopin-polonaise-op40-1', title: 'Polonaise in A major, Op. 40 No. 1 «Military»', titleUk: 'Полонез ля мажор «Військовий»', aliases: ['Military Polonaise', 'Polonaise Op. 40 No. 1'], composer: 'Frédéric Chopin', composerUk: 'Фредерік Шопен', detail: 'Op. 40 No. 1', surname: 'Chopin', query: 'Chopin Polonaise Op.40 No.1', must: ['40', '1'] },
  { id: 'chopin-polonaise-op40-2', title: 'Polonaise in C minor, Op. 40 No. 2', titleUk: 'Полонез до мінор, соч. 40 № 2', aliases: ['Polonaise Op. 40 No. 2'], composer: 'Frédéric Chopin', composerUk: 'Фредерік Шопен', detail: 'Op. 40 No. 2', surname: 'Chopin', query: 'Chopin Polonaise Op.40 No.2', must: ['40', '2'] },
  { id: 'chopin-mazurka-op7-1', title: 'Mazurka in B-flat major, Op. 7 No. 1', titleUk: 'Мазурка сі-бемоль мажор, соч. 7 № 1', aliases: ['Mazurka Op. 7 No. 1'], composer: 'Frédéric Chopin', composerUk: 'Фредерік Шопен', detail: 'Op. 7 No. 1', surname: 'Chopin', query: 'Chopin Mazurka Op.7 No.1', must: ['7', '1'] },
  { id: 'chopin-nocturne-op9-1', title: 'Nocturne in B-flat minor, Op. 9 No. 1', titleUk: 'Ноктюрн сі-бемоль мінор, соч. 9 № 1', aliases: ['Nocturne Op.9 No.1'], composer: 'Frédéric Chopin', composerUk: 'Фредерік Шопен', detail: 'Op. 9 No. 1', surname: 'Chopin', query: 'Chopin Nocturne Op.9 No.1', must: ['9', '1'] },
  { id: 'chopin-nocturne-op27-2', title: 'Nocturne in D-flat major, Op. 27 No. 2', titleUk: 'Ноктюрн ре-бемоль мажор, соч. 27 № 2', aliases: ['Nocturne Op.27 No.2'], composer: 'Frédéric Chopin', composerUk: 'Фредерік Шопен', detail: 'Op. 27 No. 2', surname: 'Chopin', query: 'Chopin Nocturne Op.27 No.2', must: ['27', '2'] },
  { id: 'chopin-nocturne-c-sharp-minor', title: 'Nocturne in C-sharp minor, Op. posth.', titleUk: 'Ноктюрн до-дієз мінор, посм.', aliases: ['Nocturne in C sharp minor', 'Posthumous Nocturne'], composer: 'Frédéric Chopin', composerUk: 'Фредерік Шопен', detail: 'Posthumous', surname: 'Chopin', query: 'Chopin Nocturne C sharp minor posthumous', must: ['sharp', 'nocturne'] },
  { id: 'debussy-arabesque-1', title: 'Arabesque No. 1', titleUk: 'Арабеска № 1', aliases: ['Arabesque 1'], composer: 'Claude Debussy', composerUk: 'Клод Дебюссі', detail: 'L. 74', surname: 'Debussy', query: 'Debussy Arabesque No.1', must: ['arabesque', '1'] },
  { id: 'debussy-reverie', title: 'Rêverie', titleUk: 'Мрія', aliases: ['Reverie', 'Reverie Debussy'], composer: 'Claude Debussy', composerUk: 'Клод Дебюссі', detail: 'L. 68', surname: 'Debussy', query: 'Debussy Reverie piano', must: ['reverie'] },
  { id: 'debussy-girl-flaxen-hair', title: 'La fille aux cheveux de lin', titleUk: 'Дівчина з льняним волоссям', aliases: ['The Girl with the Flaxen Hair', 'Girl with Flaxen Hair'], composer: 'Claude Debussy', composerUk: 'Клод Дебюссі', detail: 'from Préludes Book 1', surname: 'Debussy', query: 'Debussy La fille aux cheveux de lin', must: ['fille', 'lin'] },
  { id: 'debussy-golliwogg', title: "Golliwogg's Cakewalk", titleUk: 'Кекуок Голлівога', aliases: ['Golliwogg Cakewalk'], composer: 'Claude Debussy', composerUk: 'Клод Дебюссі', detail: 'from Children’s Corner', surname: 'Debussy', query: 'Debussy Golliwogg Cakewalk', must: ['golliwogg'] },
  { id: 'satie-gymnopedie-2', title: 'Gymnopédie No. 2', titleUk: 'Гімнопедія № 2', aliases: ['Gymnopedie No. 2'], composer: 'Erik Satie', composerUk: 'Ерік Саті', detail: 'Gymnopédie No. 2', surname: 'Satie', query: 'Satie Gymnopedie No.2', must: ['gymnopedie', '2'] },
  { id: 'satie-gymnopedie-3', title: 'Gymnopédie No. 3', titleUk: 'Гімнопедія № 3', aliases: ['Gymnopedie No. 3'], composer: 'Erik Satie', composerUk: 'Ерік Саті', detail: 'Gymnopédie No. 3', surname: 'Satie', query: 'Satie Gymnopedie No.3', must: ['gymnopedie', '3'] },
  { id: 'satie-gnossienne-1', title: 'Gnossienne No. 1', titleUk: 'Гносієнна № 1', aliases: ['Gnossienne 1'], composer: 'Erik Satie', composerUk: 'Ерік Саті', detail: 'Gnossienne No. 1', surname: 'Satie', query: 'Satie Gnossienne No.1', must: ['gnossienne', '1'] },
  { id: 'satie-gnossienne-2', title: 'Gnossienne No. 2', titleUk: 'Гносієнна № 2', aliases: ['Gnossienne 2'], composer: 'Erik Satie', composerUk: 'Ерік Саті', detail: 'Gnossienne No. 2', surname: 'Satie', query: 'Satie Gnossienne No.2', must: ['gnossienne', '2'] },
  { id: 'joplin-entertainer', title: 'The Entertainer', titleUk: 'Розважальник', aliases: ['Entertainer', 'The Entertainer Rag'], composer: 'Scott Joplin', composerUk: 'Скотт Джоплін', detail: 'Rag', surname: 'Joplin', query: 'Joplin The Entertainer', must: ['entertainer'] },
  { id: 'joplin-maple-leaf-rag', title: 'Maple Leaf Rag', titleUk: 'Регтайм «Кленовий листок»', aliases: ['Maple Leaf'], composer: 'Scott Joplin', composerUk: 'Скотт Джоплін', detail: 'Rag', surname: 'Joplin', query: 'Joplin Maple Leaf Rag', must: ['maple', 'leaf'] },
  { id: 'brahms-waltz-op39-15', title: 'Waltz in A-flat major, Op. 39 No. 15', titleUk: 'Вальс ля-бемоль мажор, соч. 39 № 15', aliases: ['Waltz Op. 39 No. 15'], composer: 'Johannes Brahms', composerUk: 'Йоганнес Брамс', detail: 'Op. 39 No. 15', surname: 'Brahms', query: 'Brahms Waltz Op.39 No.15', must: ['39', '15'] },
  { id: 'brahms-intermezzo-op118-2', title: 'Intermezzo in A major, Op. 118 No. 2', titleUk: 'Інтермецо ля мажор, соч. 118 № 2', aliases: ['Intermezzo Op. 118 No. 2'], composer: 'Johannes Brahms', composerUk: 'Йоганнес Брамс', detail: 'Op. 118 No. 2', surname: 'Brahms', query: 'Brahms Intermezzo Op.118 No.2', must: ['118', '2'] },
  { id: 'brahms-hungarian-dance-5', title: 'Hungarian Dance No. 5', titleUk: 'Угорський танець № 5', aliases: ['Hungarian Dance 5', 'Ungarischer Tanz Nr. 5'], composer: 'Johannes Brahms', composerUk: 'Йоганнес Брамс', detail: 'WoO 1 No. 5', surname: 'Brahms', query: 'Brahms Hungarian Dance No.5', must: ['hungarian', '5'] },
  { id: 'mendelssohn-venetian-boat-song', title: 'Venetian Boat Song, Op. 19 No. 6', titleUk: 'Венеціанська барка', aliases: ['Venetian Boat Song', 'Songs without Words Venetian Boat Song'], composer: 'Felix Mendelssohn', composerUk: 'Фелікс Мендельсон', detail: 'Op. 19 No. 6', surname: 'Mendelssohn', query: 'Mendelssohn Venetian Boat Song Op.19', must: ['venetian'] },
  { id: 'mendelssohn-spring-song', title: 'Spring Song, Op. 62 No. 6', titleUk: 'Весняна пісня', aliases: ['Spring Song', 'Frühlingslied'], composer: 'Felix Mendelssohn', composerUk: 'Фелікс Мендельсон', detail: 'Op. 62 No. 6', surname: 'Mendelssohn', query: 'Mendelssohn Spring Song Op.62', must: ['spring'] },
  { id: 'grieg-arietta', title: 'Arietta, Op. 12 No. 1', titleUk: 'Аріетта, соч. 12 № 1', aliases: ['Arietta'], composer: 'Edvard Grieg', composerUk: 'Едвард Гріг', detail: 'Op. 12 No. 1', surname: 'Grieg', query: 'Grieg Arietta Op.12', must: ['arietta'] },
  { id: 'grieg-wedding-day', title: 'Wedding Day at Troldhaugen, Op. 65 No. 6', titleUk: 'Весільний день у Тролдгаугені', aliases: ['Wedding Day at Troldhaugen'], composer: 'Edvard Grieg', composerUk: 'Едвард Гріг', detail: 'Op. 65 No. 6', surname: 'Grieg', query: 'Grieg Wedding Day at Troldhaugen', must: ['troldhaugen'] },
  { id: 'grieg-morning-mood', title: 'Morning Mood (Morgenstimmung), Op. 46 No. 1', titleUk: 'Ранковий настрій', aliases: ['Morning Mood', 'Morgenstimmung'], composer: 'Edvard Grieg', composerUk: 'Едвард Гріг', detail: 'Op. 46 No. 1', surname: 'Grieg', query: 'Grieg Morgenstimmung Op.46', must: ['morgenstimmung'] },
  { id: 'grieg-butterfly', title: 'Butterfly, Op. 43 No. 1', titleUk: 'Метелик, соч. 43 № 1', aliases: ['Butterfly'], composer: 'Edvard Grieg', composerUk: 'Едвард Гріг', detail: 'Op. 43 No. 1', surname: 'Grieg', query: 'Grieg Butterfly Op.43 No.1', must: ['butterfly'] },
  { id: 'brahms-wiegenlied', title: 'Wiegenlied (Lullaby), Op. 49 No. 4', titleUk: 'Колискова', aliases: ['Lullaby', 'Wiegenlied', 'Brahms Lullaby'], composer: 'Johannes Brahms', composerUk: 'Йоганнес Брамс', detail: 'Op. 49 No. 4', surname: 'Brahms', query: 'Brahms Wiegenlied Lullaby Op.49', must: ['wiegenlied'] },
  { id: 'mozart-twinkle-variations', title: 'Twinkle Twinkle Little Star Variations, K. 265', titleUk: 'Варіації «Twinkle, twinkle»', aliases: ['Twinkle Variations', 'Ah vous dirai-je maman'], composer: 'Wolfgang Amadeus Mozart', composerUk: 'Вольфганг Амадей Моцарт', detail: 'K. 265', surname: 'Mozart', query: 'Mozart Twinkle Variations K.265', must: ['265'] },
  { id: 'mozart-sonata-k545', title: 'Sonata No. 16 in C major, K. 545', titleUk: 'Соната № 16 до мажор, K. 545', aliases: ['Sonata K.545', 'Sonata Facile', 'Соната K.545'], composer: 'Wolfgang Amadeus Mozart', composerUk: 'Вольфганг Амадей Моцарт', detail: 'K. 545', surname: 'Mozart', query: 'Mozart Sonata K.545 C major', must: ['545'] },
  { id: 'mozart-fantasia-k397', title: 'Fantasia in D minor, K. 397', titleUk: 'Фантазія ре мінор, K. 397', aliases: ['Fantasia K.397'], composer: 'Wolfgang Amadeus Mozart', composerUk: 'Вольфганг Амадей Моцарт', detail: 'K. 397', surname: 'Mozart', query: 'Mozart Fantasia D minor K.397', must: ['397'] },
  { id: 'mozart-sonata-k331', title: 'Sonata No. 11 in A major, K. 331', titleUk: 'Соната № 11 ля мажор, K. 331', aliases: ['Sonata K.331'], composer: 'Wolfgang Amadeus Mozart', composerUk: 'Вольфганг Амадей Моцарт', detail: 'K. 331', surname: 'Mozart', query: 'Mozart Sonata K.331', must: ['331'] },
  { id: 'mozart-sonata-k310', title: 'Sonata No. 8 in A minor, K. 310', titleUk: 'Соната № 8 ля мінор, K. 310', aliases: ['Sonata K.310'], composer: 'Wolfgang Amadeus Mozart', composerUk: 'Вольфганг Амадей Моцарт', detail: 'K. 310', surname: 'Mozart', query: 'Mozart Sonata K.310', must: ['310'] },
  { id: 'mozart-adagio-k540', title: 'Adagio in B minor, K. 540', titleUk: 'Адажіо сі мінор, K. 540', aliases: ['Adagio K.540'], composer: 'Wolfgang Amadeus Mozart', composerUk: 'Вольфганг Амадей Моцарт', detail: 'K. 540', surname: 'Mozart', query: 'Mozart Adagio K.540', must: ['540'] },
  { id: 'bach-goldberg-aria', title: 'Goldberg Variations: Aria', titleUk: 'Гольдберг-варіації: Арія', aliases: ['Goldberg Aria', 'Aria Goldberg', 'Aria from Goldberg Variations'], composer: 'Johann Sebastian Bach', composerUk: 'Йоганн Себастьян Бах', detail: 'BWV 988', surname: 'Bach', query: 'Bach Goldberg Variations Aria BWV 988', must: ['988'] },
  { id: 'bach-italian-concerto', title: 'Italian Concerto, BWV 971', titleUk: 'Італійський концерт, BWV 971', aliases: ['Italian Concerto', 'Italienisches Konzert'], composer: 'Johann Sebastian Bach', composerUk: 'Йоганн Себастьян Бах', detail: 'BWV 971', surname: 'Bach', query: 'Bach Italian Concerto BWV 971', must: ['971'] },
  { id: 'bach-invention-1', title: 'Invention No. 1 in C major, BWV 772', titleUk: 'Інвенція № 1 до мажор, BWV 772', aliases: ['Two-Part Invention No. 1', 'Invention 1'], composer: 'Johann Sebastian Bach', composerUk: 'Йоганн Себастьян Бах', detail: 'BWV 772', surname: 'Bach', query: 'Bach Invention No.1 BWV 772', must: ['772'] },
  { id: 'bach-invention-8', title: 'Invention No. 8 in F major, BWV 779', titleUk: 'Інвенція № 8 фа мажор, BWV 779', aliases: ['Two-Part Invention No. 8', 'Invention 8'], composer: 'Johann Sebastian Bach', composerUk: 'Йоганн Себастьян Бах', detail: 'BWV 779', surname: 'Bach', query: 'Bach Invention No.8 BWV 779', must: ['779'] },
  { id: 'bach-invention-13', title: 'Invention No. 13 in A minor, BWV 784', titleUk: 'Інвенція № 13 ля мінор, BWV 784', aliases: ['Two-Part Invention No. 13', 'Invention 13'], composer: 'Johann Sebastian Bach', composerUk: 'Йоганн Себастьян Бах', detail: 'BWV 784', surname: 'Bach', query: 'Bach Invention No.13 BWV 784', must: ['784'] },
  { id: 'bach-minuet-g', title: 'Minuet in G major, BWV Anh. 114', titleUk: 'Менует соль мажор, BWV Anh. 114', aliases: ['Minuet in G', 'Menuet in G', 'Minuet from Anna Magdalena Notebook'], composer: 'Johann Sebastian Bach', composerUk: 'Йоганн Себастьян Бах', detail: 'BWV Anh. 114', surname: 'Bach', query: 'Bach Minuet in G BWV Anh 114', must: ['114'] },
  { id: 'bach-prelude-c-minor-bwv999', title: 'Prelude in C minor, BWV 999', titleUk: 'Прелюдія до мінор, BWV 999', aliases: ['Prelude BWV 999'], composer: 'Johann Sebastian Bach', composerUk: 'Йоганн Себастьян Бах', detail: 'BWV 999', surname: 'Bach', query: 'Bach Prelude C minor BWV 999', must: ['999'] },
  { id: 'beethoven-waldstein', title: 'Waldstein Sonata, Op. 53', titleUk: 'Соната «Вальдштайн»', aliases: ['Waldstein', 'Sonata No. 21'], composer: 'Ludwig van Beethoven', composerUk: 'Людвіг ван Бетховен', detail: 'Op. 53', surname: 'Beethoven', query: 'Beethoven Waldstein Sonata Op.53', must: ['waldstein'] },
  { id: 'beethoven-funeral-march', title: 'Sonata No. 12 «Funeral March», Op. 26', titleUk: 'Соната № 12 «Похоронний марш»', aliases: ['Funeral March Sonata', 'Sonata Op. 26'], composer: 'Ludwig van Beethoven', composerUk: 'Людвіг ван Бетховен', detail: 'Op. 26', surname: 'Beethoven', query: 'Beethoven Sonata Op.26 Funeral March', must: ['26'] },
  { id: 'beethoven-ecossaises', title: 'Ecossaises, WoO 83', titleUk: 'Шотландські танці, WoO 83', aliases: ['Scottish Dances', 'Ecossaise'], composer: 'Ludwig van Beethoven', composerUk: 'Людвіг ван Бетховен', detail: 'WoO 83', surname: 'Beethoven', query: 'Beethoven Ecossaises WoO 83', must: ['ecossaises'] },
  { id: 'schubert-impromptu-d899-3', title: 'Impromptu in G-flat major, D. 899 No. 3', titleUk: 'Експромт соль-бемоль мажор, D. 899 № 3', aliases: ['Impromptu Op. 90 No. 3', 'Impromptu D899'], composer: 'Franz Schubert', composerUk: 'Франц Шуберт', detail: 'D. 899 No. 3', surname: 'Schubert', query: 'Schubert Impromptu D.899 No.3', must: ['899', '3'] },
  { id: 'schubert-impromptu-d899-4', title: 'Impromptu in A-flat major, D. 899 No. 4', titleUk: 'Експромт ля-бемоль мажор, D. 899 № 4', aliases: ['Impromptu Op. 90 No. 4', 'Impromptu D899 4'], composer: 'Franz Schubert', composerUk: 'Франц Шуберт', detail: 'D. 899 No. 4', surname: 'Schubert', query: 'Schubert Impromptu D.899 No.4', must: ['899', '4'] },
  { id: 'schubert-moment-musical-3', title: 'Moments musicaux No. 3, D. 780', titleUk: 'Музичні миттєвості № 3, D. 780', aliases: ['Moments Musicaux No. 3', 'Musical Moments 3'], composer: 'Franz Schubert', composerUk: 'Франц Шуберт', detail: 'D. 780 No. 3', surname: 'Schubert', query: 'Schubert Moments musicaux No.3 D.780', must: ['780'] },
  { id: 'schubert-standchen', title: 'Serenade (Ständchen), D. 957 No. 4', titleUk: 'Серенада', aliases: ['Serenade', 'Standchen', 'Ständchen'], composer: 'Franz Schubert', composerUk: 'Франц Шуберт', detail: 'D. 957 No. 4', surname: 'Schubert', query: 'Schubert Standchen piano', must: ['standchen'] },
  { id: 'schubert-wanderer-fantasy', title: 'Wanderer Fantasy, D. 760', titleUk: 'Фантазія «Мандрівник»', aliases: ['Wanderer Fantasy', 'Wandererfantasie'], composer: 'Franz Schubert', composerUk: 'Франц Шуберт', detail: 'D. 760', surname: 'Schubert', query: 'Schubert Wanderer Fantasy D.760', must: ['wanderer'] },
  { id: 'schumann-arabeske', title: 'Arabeske in C major, Op. 18', titleUk: 'Арабеска до мажор, соч. 18', aliases: ['Arabeske', 'Arabesque Schumann'], composer: 'Robert Schumann', composerUk: 'Роберт Шуман', detail: 'Op. 18', surname: 'Schumann', query: 'Schumann Arabeske Op.18', must: ['18'] },
  { id: 'schumann-kinderszenen', title: 'Kinderszenen, Op. 15', titleUk: 'Дитячі сцени, соч. 15', aliases: ['Scenes from Childhood', 'Kinderszenen'], composer: 'Robert Schumann', composerUk: 'Роберт Шуман', detail: 'Op. 15', surname: 'Schumann', query: 'Schumann Kinderszenen Op.15', must: ['kinderszenen'] },
  { id: 'tchaikovsky-june', title: 'The Seasons: June (Barcarolle), Op. 37a No. 6', titleUk: 'Пори року: Червень', aliases: ['June Barcarolle', 'The Seasons June'], composer: 'Pyotr Ilyich Tchaikovsky', composerUk: 'Петро Ілліч Чайковський', detail: 'Op. 37a No. 6', surname: 'Tchaikovsky', query: 'Tchaikovsky The Seasons June Op.37a', must: ['june'] },
  { id: 'tchaikovsky-october', title: 'The Seasons: October (Autumn Song), Op. 37a No. 10', titleUk: 'Пори року: Жовтень', aliases: ['October Autumn Song', 'The Seasons October'], composer: 'Pyotr Ilyich Tchaikovsky', composerUk: 'Петро Ілліч Чайковський', detail: 'Op. 37a No. 10', surname: 'Tchaikovsky', query: 'Tchaikovsky The Seasons October Op.37a', must: ['october'] },
  { id: 'liszt-consolation-3', title: 'Consolation No. 3, S. 172', titleUk: 'Втіха № 3', aliases: ['Consolation No. 3', 'Consolations 3'], composer: 'Franz Liszt', composerUk: 'Ференц Ліст', detail: 'S. 172 No. 3', surname: 'Liszt', query: 'Liszt Consolation No.3 S.172', must: ['consolation', '3'] },
  { id: 'liszt-la-campanella', title: 'La campanella', titleUk: 'Кампанелла', aliases: ['La Campanella', 'Campanella'], composer: 'Franz Liszt', composerUk: 'Ференц Ліст', detail: 'S. 141 No. 3', surname: 'Liszt', query: 'Liszt La campanella S.141', must: ['campanella'] },
  { id: 'liszt-un-sospiro', title: 'Un sospiro, S. 144 No. 3', titleUk: 'Зітхання', aliases: ['Un Sospiro', 'Sigh'], composer: 'Franz Liszt', composerUk: 'Ференц Ліст', detail: 'S. 144 No. 3', surname: 'Liszt', query: 'Liszt Un sospiro S.144', must: ['sospiro'] },
  { id: 'liszt-hungarian-rhapsody-2', title: 'Hungarian Rhapsody No. 2, S. 244/2', titleUk: 'Угорська рапсодія № 2', aliases: ['Hungarian Rhapsody 2', 'Ungarische Rhapsodie Nr. 2'], composer: 'Franz Liszt', composerUk: 'Ференц Ліст', detail: 'S. 244/2', surname: 'Liszt', query: 'Liszt Hungarian Rhapsody No.2', must: ['rhapsody', '2'] },
  { id: 'albeniz-asturias', title: 'Asturias (Leyenda), Op. 47', titleUk: 'Астурія (Легенда)', aliases: ['Asturias', 'Leyenda'], composer: 'Isaac Albéniz', composerUk: 'Ісаак Альбеніс', detail: 'Op. 47', surname: 'Albeniz', query: 'Albeniz Asturias Leyenda', must: ['asturias'] },
  { id: 'dvorak-humoresque-7', title: 'Humoresque No. 7, Op. 101', titleUk: 'Гумореска № 7, соч. 101', aliases: ['Humoresque', 'Dvorak Humoresque'], composer: 'Antonín Dvořák', composerUk: 'Антонін Дворжак', detail: 'Op. 101 No. 7', surname: 'Dvorak', query: 'Dvorak Humoresque Op.101 No.7', must: ['humoresque', '7'] },
  { id: 'rachmaninoff-prelude-csm', title: 'Prelude in C-sharp minor, Op. 3 No. 2', titleUk: 'Прелюдія до-дієз мінор, соч. 3 № 2', aliases: ['Prelude in C sharp minor', 'Prelude Op. 3 No. 2'], composer: 'Sergei Rachmaninoff', composerUk: 'Сергій Рахманінов', detail: 'Op. 3 No. 2', surname: 'Rachmaninoff', query: 'Rachmaninoff Prelude C-sharp minor Op.3 No.2', must: ['3', '2'] },
  { id: 'rachmaninoff-prelude-g-minor', title: 'Prelude in G minor, Op. 23 No. 5', titleUk: 'Прелюдія соль мінор, соч. 23 № 5', aliases: ['Prelude Op. 23 No. 5'], composer: 'Sergei Rachmaninoff', composerUk: 'Сергій Рахманінов', detail: 'Op. 23 No. 5', surname: 'Rachmaninoff', query: 'Rachmaninoff Prelude Op.23 No.5', must: ['23', '5'] },
  { id: 'scriabin-etude-op8-12', title: 'Étude in D-sharp minor, Op. 8 No. 12', titleUk: 'Етюд ре-дієз мінор, соч. 8 № 12', aliases: ['Etude Op. 8 No. 12', 'Scriabin Etude'], composer: 'Alexander Scriabin', composerUk: 'Олександр Скрябін', detail: 'Op. 8 No. 12', surname: 'Scriabin', query: 'Scriabin Etude Op.8 No.12', must: ['8', '12'] },
  { id: 'mussorgsky-pictures', title: 'Pictures at an Exhibition', titleUk: 'Картинки з виставки', aliases: ['Pictures at an Exhibition', 'Kartinki s vystavki'], composer: 'Modest Mussorgsky', composerUk: 'Модест Мусоргський', detail: 'piano score', surname: 'Mussorgsky', query: 'Mussorgsky Pictures at an Exhibition piano', must: ['pictures'] },
  { id: 'clementi-sonatina-op36-1', title: 'Sonatina in C major, Op. 36 No. 1', titleUk: 'Сонатина до мажор, соч. 36 № 1', aliases: ['Sonatina Op. 36 No. 1', 'Clementi Sonatina'], composer: 'Muzio Clementi', composerUk: 'Муцио Клементі', detail: 'Op. 36 No. 1', surname: 'Clementi', query: 'Clementi Sonatina Op.36 No.1', must: ['36', '1'] },
  { id: 'clementi-sonatina-op36-3', title: 'Sonatina in C major, Op. 36 No. 3', titleUk: 'Сонатина до мажор, соч. 36 № 3', aliases: ['Sonatina Op. 36 No. 3'], composer: 'Muzio Clementi', composerUk: 'Муцио Клементі', detail: 'Op. 36 No. 3', surname: 'Clementi', query: 'Clementi Sonatina Op.36 No.3', must: ['36', '3'] },
  { id: 'kuhlau-sonatina-op55-1', title: 'Sonatina in C major, Op. 55 No. 1', titleUk: 'Сонатина до мажор, соч. 55 № 1', aliases: ['Kuhlau Sonatina'], composer: 'Friedrich Kuhlau', composerUk: 'Фрідріх Кулау', detail: 'Op. 55 No. 1', surname: 'Kuhlau', query: 'Kuhlau Sonatina Op.55 No.1', must: ['55', '1'] },
  { id: 'burgmuller-25-studies', title: '25 Easy Studies, Op. 100', titleUk: '25 легких етюдів, соч. 100', aliases: ['25 Etudes Op. 100', 'Burgmuller Op. 100'], composer: 'Friedrich Burgmüller', composerUk: 'Фрідріх Бургмюллер', detail: 'Op. 100', surname: 'Burgmuller', query: 'Burgmuller 25 Etudes Op.100', must: ['100'] },
  { id: 'czerny-op599', title: 'Practical Method for Beginners, Op. 599', titleUk: 'Практичний метод для початківців, соч. 599', aliases: ['Czerny Op. 599', 'Czerny 599'], composer: 'Carl Czerny', composerUk: 'Карл Черні', detail: 'Op. 599', surname: 'Czerny', query: 'Czerny Op.599 piano', must: ['599'] },
  { id: 'czerny-op299', title: 'The School of Velocity, Op. 299', titleUk: 'Школа швидкості, соч. 299', aliases: ['Czerny Op. 299', 'School of Velocity'], composer: 'Carl Czerny', composerUk: 'Карл Черні', detail: 'Op. 299', surname: 'Czerny', query: 'Czerny School of Velocity Op.299', must: ['299'] },
  { id: 'beyer-op101', title: 'Progressive Pianoforte Studies, Op. 101', titleUk: 'Прогресивні етюди для фортепіано, соч. 101', aliases: ['Beyer Op. 101', 'Beyer'], composer: 'Ferdinand Beyer', composerUk: 'Фердинанд Бейєр', detail: 'Op. 101', surname: 'Beyer', query: 'Beyer Progressive Pianoforte Studies Op.101', must: ['101'] },
  { id: 'hanon-virtuoso-pianist', title: 'The Virtuoso Pianist, Part I', titleUk: 'Піаніст-віртуоз, частина I', aliases: ['Hanon', 'The Virtuoso Pianist'], composer: 'Charles-Louis Hanon', composerUk: 'Шарль-Луї Ганон', detail: 'Part I', surname: 'Hanon', query: 'Hanon The Virtuoso Pianist', must: ['virtuoso'] },
  { id: 'lysenko-elegy', title: 'Elegy', titleUk: 'Елегія', aliases: ['Елегія', 'Lysenko Elegy'], composer: 'Mykola Lysenko', composerUk: 'Микола Лисенко', detail: 'piano', surname: 'Lysenko', query: 'Lysenko Elegy piano', must: ['elegy'] },
  { id: 'scarlatti-k9', title: 'Sonata in D minor, K. 9', titleUk: 'Соната ре мінор, K. 9', aliases: ['Scarlatti K. 9', 'Sonata K.9'], composer: 'Domenico Scarlatti', composerUk: 'Доменіко Скарлатті', detail: 'K. 9', surname: 'Scarlatti', query: 'Scarlatti Sonata K.9 D minor', must: ['9'] },
  { id: 'couperin-carillon', title: 'Le Carillon de Cythère', titleUk: 'Дзвони Кіфери', aliases: ['Carillon de Cythere', 'The Carillon of Cythera'], composer: 'François Couperin', composerUk: 'Франсуа Куперен', detail: 'Ordre 6', surname: 'Couperin', query: 'Couperin Le Carillon de Cythere', must: ['carillon'] },
  { id: 'rameau-rappel-oiseaux', title: 'Le Rappel des oiseaux', titleUk: 'Поклик птахів', aliases: ['Rappel des oiseaux', 'The Call of the Birds'], composer: 'Jean-Philippe Rameau', composerUk: 'Жан-Філіпп Рамо', detail: 'harpsichord', surname: 'Rameau', query: 'Rameau Le Rappel des oiseaux', must: ['rappel'] },
  { id: 'haydn-gypsy-rondo', title: 'Gypsy Rondo, Hob. XV:33', titleUk: 'Циганське рондо', aliases: ['Gypsy Rondo', 'Rondo all’ongarese'], composer: 'Joseph Haydn', composerUk: 'Йозеф Гайдн', detail: 'Hob. XV:33', surname: 'Haydn', query: 'Haydn Gypsy Rondo Hob XV 33', must: ['gypsy'] },
  { id: 'debussy-cathedrale-engloutie', title: 'La cathédrale engloutie', titleUk: 'Затонулий собор', aliases: ['The Sunken Cathedral', 'Cathedral engloutie'], composer: 'Claude Debussy', composerUk: 'Клод Дебюссі', detail: 'Prélude Book 1', surname: 'Debussy', query: 'Debussy La cathedrale engloutie', must: ['cathedrale'] },
  { id: 'debussy-doctor-gradus', title: 'Doctor Gradus ad Parnassum', titleUk: 'Доктор Градус ad Parnassum', aliases: ['Doctor Gradus', 'Gradus ad Parnassum'], composer: 'Claude Debussy', composerUk: 'Клод Дебюссі', detail: 'from Children’s Corner', surname: 'Debussy', query: 'Debussy Doctor Gradus ad Parnassum', must: ['gradus'] },
  { id: 'debussy-des-pas-sur-la-neige', title: 'Des pas sur la neige', titleUk: 'Сліди на снігу', aliases: ['Footprints in the Snow', 'Footsteps in the Snow'], composer: 'Claude Debussy', composerUk: 'Клод Дебюссі', detail: 'Prélude Book 1', surname: 'Debussy', query: 'Debussy Des pas sur la neige', must: ['neige'] },
  { id: 'debussy-arabesque-2', title: 'Arabesque No. 2', titleUk: 'Арабеска № 2', aliases: ['Arabesque 2'], composer: 'Claude Debussy', composerUk: 'Клод Дебюссі', detail: 'L. 66', surname: 'Debussy', query: 'Debussy Arabesque No.2', must: ['arabesque', '2'] },
  { id: 'grieg-notturno', title: 'Notturno, Op. 54 No. 4', titleUk: 'Нотюрно, соч. 54 № 4', aliases: ['Notturno'], composer: 'Edvard Grieg', composerUk: 'Едвард Гріг', detail: 'Op. 54 No. 4', surname: 'Grieg', query: 'Grieg Notturno Op.54', must: ['notturno'] },
  { id: 'mendelssohn-rondo-capriccioso', title: 'Rondo capriccioso, Op. 14', titleUk: 'Рондо-капріччіо, соч. 14', aliases: ['Rondo Capriccioso'], composer: 'Felix Mendelssohn', composerUk: 'Фелікс Мендельсон', detail: 'Op. 14', surname: 'Mendelssohn', query: 'Mendelssohn Rondo capriccioso Op.14', must: ['capriccioso'] },
  { id: 'satie-gnossienne-3', title: 'Gnossienne No. 3', titleUk: 'Гносієнна № 3', aliases: ['Gnossienne 3'], composer: 'Erik Satie', composerUk: 'Ерік Саті', detail: 'Gnossienne No. 3', surname: 'Satie', query: 'Satie Gnossienne No.3', must: ['gnossienne', '3'] },
  { id: 'chopin-impromptu-1', title: 'Impromptu No. 1 in A-flat major, Op. 29', titleUk: 'Експромт № 1 ля-бемоль мажор, соч. 29', aliases: ['Impromptu Op. 29'], composer: 'Frédéric Chopin', composerUk: 'Фредерік Шопен', detail: 'Op. 29', surname: 'Chopin', query: 'Chopin Impromptu Op.29', must: ['29'] },
  { id: 'chopin-berceuse', title: 'Berceuse in D-flat major, Op. 57', titleUk: 'Колискова ре-бемоль мажор, соч. 57', aliases: ['Berceuse', 'Lullaby Chopin'], composer: 'Frédéric Chopin', composerUk: 'Фредерік Шопен', detail: 'Op. 57', surname: 'Chopin', query: 'Chopin Berceuse Op.57', must: ['57'] },
  { id: 'chopin-barcarolle', title: 'Barcarolle in F-sharp major, Op. 60', titleUk: 'Баркарола фа-дієз мажор, соч. 60', aliases: ['Barcarolle'], composer: 'Frédéric Chopin', composerUk: 'Фредерік Шопен', detail: 'Op. 60', surname: 'Chopin', query: 'Chopin Barcarolle Op.60', must: ['60'] },
  { id: 'chopin-ballade-2', title: 'Ballade No. 2 in F major, Op. 38', titleUk: 'Балада № 2 фа мажор, соч. 38', aliases: ['Ballade No. 2'], composer: 'Frédéric Chopin', composerUk: 'Фредерік Шопен', detail: 'Op. 38', surname: 'Chopin', query: 'Chopin Ballade No.2 Op.38', must: ['38'] },
  { id: 'chopin-ballade-4', title: 'Ballade No. 4 in F minor, Op. 52', titleUk: 'Балада № 4 фа мінор, соч. 52', aliases: ['Ballade No. 4'], composer: 'Frédéric Chopin', composerUk: 'Фредерік Шопен', detail: 'Op. 52', surname: 'Chopin', query: 'Chopin Ballade No.4 Op.52', must: ['52'] },
  { id: 'chopin-scherzo-2', title: 'Scherzo No. 2 in B-flat minor, Op. 31', titleUk: 'Скерцо № 2 сі-бемоль мінор, соч. 31', aliases: ['Scherzo No. 2'], composer: 'Frédéric Chopin', composerUk: 'Фредерік Шопен', detail: 'Op. 31', surname: 'Chopin', query: 'Chopin Scherzo No.2 Op.31', must: ['31'] },
  { id: 'chopin-etude-op25-1', title: 'Étude in A-flat major, Op. 25 No. 1 «Aeolian Harp»', titleUk: 'Етюд ля-бемоль мажор «Ейолова арфа»', aliases: ['Aeolian Harp', 'Etude Op. 25 No. 1'], composer: 'Frédéric Chopin', composerUk: 'Фредерік Шопен', detail: 'Op. 25 No. 1', surname: 'Chopin', query: 'Chopin Etude Op.25 No.1', must: ['25', '1'] },
  { id: 'chopin-etude-op25-11', title: 'Étude in A minor, Op. 25 No. 11 «Winter Wind»', titleUk: 'Етюд ля мінор «Зимовий вітер»', aliases: ['Winter Wind', 'Etude Op. 25 No. 11'], composer: 'Frédéric Chopin', composerUk: 'Фредерік Шопен', detail: 'Op. 25 No. 11', surname: 'Chopin', query: 'Chopin Etude Op.25 No.11', must: ['25', '11'] },
  { id: 'chopin-waltz-op69-1', title: 'Waltz in A-flat major, Op. 69 No. 1 «Farewell»', titleUk: 'Вальс ля-бемоль мажор «Прощальний»', aliases: ['Farewell Waltz', 'Waltz Op. 69 No. 1'], composer: 'Frédéric Chopin', composerUk: 'Фредерік Шопен', detail: 'Op. 69 No. 1', surname: 'Chopin', query: 'Chopin Waltz Op.69 No.1', must: ['69', '1'] },
  { id: 'chopin-polonaise-heroic', title: 'Polonaise in A-flat major, Op. 53 «Heroic»', titleUk: 'Полонез ля-бемоль мажор «Героїчний»', aliases: ['Heroic Polonaise', 'Polonaise Op. 53'], composer: 'Frédéric Chopin', composerUk: 'Фредерік Шопен', detail: 'Op. 53', surname: 'Chopin', query: 'Chopin Polonaise Op.53 Heroic', must: ['53'] },
  { id: 'chopin-nocturne-op48-1', title: 'Nocturne in C minor, Op. 48 No. 1', titleUk: 'Ноктюрн до мінор, соч. 48 № 1', aliases: ['Nocturne Op. 48 No. 1'], composer: 'Frédéric Chopin', composerUk: 'Фредерік Шопен', detail: 'Op. 48 No. 1', surname: 'Chopin', query: 'Chopin Nocturne Op.48 No.1', must: ['48', '1'] },
  { id: 'chopin-prelude-op28-1', title: 'Prelude in C major, Op. 28 No. 1', titleUk: 'Прелюдія до мажор, соч. 28 № 1', aliases: ['Prelude Op. 28 No. 1'], composer: 'Frédéric Chopin', composerUk: 'Фредерік Шопен', detail: 'Op. 28 No. 1', surname: 'Chopin', query: 'Chopin Prelude Op.28 No.1', must: ['28', '1'] },
  { id: 'chopin-prelude-op28-6', title: 'Prelude in B minor, Op. 28 No. 6', titleUk: 'Прелюдія сі мінор, соч. 28 № 6', aliases: ['Prelude Op. 28 No. 6'], composer: 'Frédéric Chopin', composerUk: 'Фредерік Шопен', detail: 'Op. 28 No. 6', surname: 'Chopin', query: 'Chopin Prelude Op.28 No.6', must: ['28', '6'] },
  { id: 'chopin-sonata-2', title: 'Piano Sonata No. 2 in B-flat minor, Op. 35', titleUk: 'Соната № 2 сі-бемоль мінор, соч. 35', aliases: ['Funeral March Sonata Chopin'], composer: 'Frédéric Chopin', composerUk: 'Фредерік Шопен', detail: 'Op. 35', surname: 'Chopin', query: 'Chopin Piano Sonata No.2 Op.35', must: ['35'] },
  { id: 'schubert-impromptu-d935-3', title: 'Impromptu in B-flat major, D. 935 No. 3', titleUk: 'Експромт сі-бемоль мажор, D. 935 № 3', aliases: ['Impromptu D.935'], composer: 'Franz Schubert', composerUk: 'Франц Шуберт', detail: 'D. 935 No. 3', surname: 'Schubert', query: 'Schubert Impromptu D.935 No.3', must: ['935', '3'] },
  { id: 'liszt-liebestraum-1', title: 'Liebestraum No. 1, S. 541', titleUk: 'Мрія № 1', aliases: ['Liebestraum No. 1'], composer: 'Franz Liszt', composerUk: 'Ференц Ліст', detail: 'S. 541 No. 1', surname: 'Liszt', query: 'Liszt Liebestraum No.1', must: ['liebestraum', '1'] },
  { id: 'grieg-lyric-pieces-op12', title: 'Lyric Pieces, Op. 12', titleUk: 'Ліричні п’єси, соч. 12', aliases: ['Lyric Pieces Op. 12'], composer: 'Edvard Grieg', composerUk: 'Едвард Гріг', detail: 'Op. 12', surname: 'Grieg', query: 'Grieg Lyric Pieces Op.12', must: ['12'] },
  { id: 'tchaikovsky-album-young-sweet-dreams', title: 'Sweet Dreams, Op. 39 No. 20', titleUk: 'Солодкі сни, соч. 39 № 20', aliases: ['Sweet Dreams', 'Album for the Young Sweet Dreams'], composer: 'Pyotr Ilyich Tchaikovsky', composerUk: 'Петро Ілліч Чайковський', detail: 'Op. 39 No. 20', surname: 'Tchaikovsky', query: 'Tchaikovsky Sweet Dreams Album for the Young', must: ['sweet'] },
  { id: 'burgmuller-arabesque', title: 'Arabesque, Op. 100 No. 2', titleUk: 'Арабеска, соч. 100 № 2', aliases: ['Burgmuller Arabesque'], composer: 'Friedrich Burgmüller', composerUk: 'Фрідріх Бургмюллер', detail: 'Op. 100 No. 2', surname: 'Burgmuller', query: 'Burgmuller Arabesque Op.100 No.2', must: ['arabesque', '100'] },
  { id: 'joplin-easy-winners', title: 'The Easy Winners', titleUk: 'Легкі переможці', aliases: ['Easy Winners'], composer: 'Scott Joplin', composerUk: 'Скотт Джоплін', detail: 'Rag', surname: 'Joplin', query: 'Joplin The Easy Winners', must: ['easy', 'winners'] },
  { id: 'bach-prelude-d-bwv850', title: 'Prelude in D major, BWV 850', titleUk: 'Прелюдія ре мажор, BWV 850', aliases: ['Prelude BWV 850'], composer: 'Johann Sebastian Bach', composerUk: 'Йоганн Себастьян Бах', detail: 'BWV 850', surname: 'Bach', query: 'Bach Prelude D major BWV 850', must: ['850'] },
  { id: 'bach-little-prelude-c-bwv939', title: 'Little Prelude in C major, BWV 939', titleUk: 'Маленька прелюдія до мажор, BWV 939', aliases: ['Little Prelude BWV 939'], composer: 'Johann Sebastian Bach', composerUk: 'Йоганн Себастьян Бах', detail: 'BWV 939', surname: 'Bach', query: 'Bach Little Prelude C major BWV 939', must: ['939'] },
];

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const hasWord = (title, token) => ` ${norm(title)} `.includes(` ${norm(token)} `);
const hasText = (title, part) => norm(title).includes(norm(part));

export function isAllowedLicense(s) {
  if (typeof s !== 'string') return false;
  const t = s.trim();
  return t === 'Public domain' || t.startsWith('PD') || t === 'CC0' || t.startsWith('CC BY ') || t.startsWith('CC BY-SA ');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Retries 429 and 5xx with growing waits (the Commons API rate-limits bursts).
async function apiGet(params) {
  const url = new URL(API);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  let wait = 5000;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) return res.json();
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= 6) throw new Error(`HTTP ${res.status}`);
    await sleep(wait);
    wait *= 2;
  }
}

function pagesOf(ii) {
  const m = (ii.metadata || []).find((x) => x.name === 'Pages');
  const n = m ? Number(m.value) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toCandidate(page, item) {
  const ii = page.imageinfo?.[0];
  if (!ii) return null;
  const fileTitle = String(page.title || '').replace(/^File:/, '');
  const license = ii.extmetadata?.LicenseShortName?.value ?? null;
  const url = new URL(ii.url);
  url.search = '';
  if (ii.mime !== 'application/pdf') return null;
  if (!url.href.toLowerCase().endsWith('.pdf')) return null;
  if (url.hostname !== 'upload.wikimedia.org') return null;
  if (ii.size < MIN_BYTES || ii.size > MAX_BYTES) return null;
  if (!isAllowedLicense(license)) return null;
  if (!hasText(fileTitle, item.surname)) return null;
  const lower = norm(fileTitle);
  if (EXCLUDED.some((w) => lower.includes(w))) return null;
  if (!item.must.every((t) => hasWord(fileTitle, t))) return null;
  const pages = pagesOf(ii);
  return {
    fileTitle,
    fileUrl: url.href,
    pageUrl: ii.descriptionurl ?? null,
    license,
    sizeBytes: ii.size,
    pages,
    startsIMSLP: fileTitle.startsWith('IMSLP') ? 0 : 1,
    pagePref: pages !== null && pages <= MAX_PAGES_PREFERRED ? 0 : 1,
    rank: page.index ?? 9999,
  };
}

async function resolveItem(item) {
  const data = await apiGet({
    action: 'query',
    generator: 'search',
    gsrsearch: `${item.query} filetype:pdf`,
    gsrnamespace: 6,
    gsrlimit: 15,
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata|metadata',
    format: 'json',
    origin: '*',
  });
  const pages = Object.values(data.query?.pages || {});
  const cands = pages.map((p) => toCandidate(p, item)).filter(Boolean);
  cands.sort((a, b) => a.startsIMSLP - b.startsIMSLP || a.pagePref - b.pagePref || a.rank - b.rank);
  return cands[0] ?? null;
}

async function main() {
  const check = process.argv.includes('--check');
  const out = [];
  const unresolved = [];
  const lines = [];
  for (const item of CURATED) {
    let hit = null;
    try {
      hit = await resolveItem(item);
    } catch (e) {
      console.error(`ERROR ${item.id}: ${e.message}`);
    }
    await sleep(DELAY_MS);
    const entry = {
      id: item.id,
      title: item.title,
      titleUk: item.titleUk,
      aliases: item.aliases,
      composer: item.composer,
      composerUk: item.composerUk,
      detail: item.detail,
      fileUrl: hit ? hit.fileUrl : null,
      pageUrl: hit ? hit.pageUrl : null,
      license: hit ? hit.license : null,
      sizeBytes: hit ? hit.sizeBytes : null,
      pages: hit ? hit.pages : null,
    };
    out.push(entry);
    if (hit) {
      lines.push(`${item.title} -> ${hit.fileTitle} | ${hit.pages ?? '?'} p | ${Math.round(hit.sizeBytes / 1024)} KB`);
    } else {
      unresolved.push(item.title);
    }
  }
  const ids = new Set(out.map((e) => e.id));
  if (ids.size !== out.length) throw new Error('duplicate ids');
  await writeFile(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(`total: ${out.length}`);
  console.log(`resolved: ${out.length - unresolved.length}`);
  console.log(`unresolved (${unresolved.length}): ${unresolved.join('; ')}`);
  console.log('--- resolved lines ---');
  for (const l of lines) console.log(l);
  if (check) {
    const dead = [];
    for (const e of out.filter((x) => x.fileUrl)) {
      try {
        const r = await fetch(e.fileUrl, { method: 'HEAD', headers: { 'User-Agent': UA } });
        if (!r.ok) dead.push(`${e.id} ${r.status}`);
      } catch (err) {
        dead.push(`${e.id} ${err.message}`);
      }
      await sleep(DELAY_MS);
    }
    console.log(`dead links: ${dead.length}`);
    for (const d of dead) console.log(d);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
