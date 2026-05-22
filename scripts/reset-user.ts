// Investiga e (com --confirm) reseta um usuário pra ele testar do zero:
// zera a coleção (user_stickers), tira a conquista Elite (user_achievements)
// e desliga o Premium (profiles.is_premium + zera elite_covers_generated).
//
// Dry-run (só mostra, não altera nada):
//   npx tsx scripts/reset-user.ts "Vinicius Sevalli"
// Aplica o reset de verdade:
//   npx tsx scripts/reset-user.ts "Vinicius Sevalli" --confirm
//
// .env requer EXPO_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Faltam EXPO_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env');
  process.exit(1);
}

const rawArgs = process.argv.slice(2);
const confirm = rawArgs.includes('--confirm');
const nameQuery = rawArgs.find((a) => !a.startsWith('--'));
if (!nameQuery) {
  console.error('Uso: npx tsx scripts/reset-user.ts "<nome>" [--confirm]');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, display_name, city, state, is_premium, elite_covers_generated')
    .ilike('display_name', `%${nameQuery}%`);
  if (pErr) {
    console.error('Erro buscando profile:', pErr.message);
    process.exit(1);
  }
  if (!profiles || profiles.length === 0) {
    console.error(`Nenhum usuário com display_name contendo "${nameQuery}".`);
    process.exit(1);
  }
  if (profiles.length > 1) {
    console.error(`Mais de um usuário bate com "${nameQuery}" — refine o nome:`);
    for (const p of profiles) {
      console.error(`  - "${p.display_name}" (${p.city ?? '?'}/${p.state ?? '?'}) — id ${p.id}`);
    }
    process.exit(1);
  }

  const user = profiles[0];

  let email = '(desconhecido)';
  try {
    const { data: adminData } = await supabase.auth.admin.getUserById(user.id);
    email = adminData?.user?.email ?? email;
  } catch {
    /* segue sem email */
  }

  const { count: stickerCount } = await supabase
    .from('user_stickers')
    .select('sticker_id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  const { data: achievements } = await supabase
    .from('user_achievements')
    .select('code')
    .eq('user_id', user.id);

  console.log('=== USUÁRIO ENCONTRADO ===');
  console.log(`  Nome:    ${user.display_name} (${user.city ?? '?'}/${user.state ?? '?'})`);
  console.log(`  Email:   ${email}`);
  console.log(`  ID:      ${user.id}`);
  console.log(`  Premium: ${user.is_premium}`);
  console.log(`  Contador de capas Elite: ${user.elite_covers_generated ?? 0}`);
  console.log(`  Figurinhas na coleção:   ${stickerCount ?? 0}`);
  console.log(`  Conquistas: ${(achievements ?? []).map((a) => a.code).join(', ') || '(nenhuma)'}`);

  if (!confirm) {
    console.log('\n[DRY-RUN] Nada foi alterado.');
    console.log('Pra aplicar o reset, rode de novo com --confirm.');
    return;
  }

  console.log('\n=== APLICANDO O RESET ===');

  const { error: e1, count: delStickers } = await supabase
    .from('user_stickers')
    .delete({ count: 'exact' })
    .eq('user_id', user.id);
  console.log(
    e1
      ? `  x coleção: ${e1.message}`
      : `  ok coleção zerada (${delStickers ?? 0} figurinhas removidas)`,
  );

  const { error: e2, count: delAch } = await supabase
    .from('user_achievements')
    .delete({ count: 'exact' })
    .eq('user_id', user.id)
    .eq('code', 'elite_collector');
  console.log(
    e2
      ? `  x conquista Elite: ${e2.message}`
      : `  ok conquista Elite removida (${delAch ?? 0})`,
  );

  const { error: e3 } = await supabase
    .from('profiles')
    .update({
      is_premium: false,
      elite_covers_generated: 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);
  console.log(
    e3
      ? `  x premium: ${e3.message}`
      : '  ok Premium desligado e contador de capas Elite zerado',
  );

  if (e1 || e2 || e3) {
    console.log('\nTerminou COM ERROS — revisa acima.');
    process.exit(1);
  }
  console.log('\nPronto. O Vinicius pode testar do zero.');
}

main();
