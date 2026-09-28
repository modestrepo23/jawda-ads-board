/* Board configuration.

   Out of the box the board saves to the browser you are using (localStorage).
   That is fine for one person. For the whole team to see the same board live,
   create a free Supabase project, run supabase/schema.sql in its SQL editor,
   then paste the project URL and anon key below. See README.md. */

window.JAWDA_CONFIG = {
  supabase: {
  url: 'https://gqagsngzacidzxdrdeqx.supabase.co',
    anonKey: 'sb_publishable_yreVl_8J94O8CxvIoNyicQ_kcxA4WGU',    // the "anon public" key from Project settings > API
    boardKey: 'silibi-meta-vol3'  // one key per board; change it to run a second board
  }
};
