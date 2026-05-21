# Política de Privacidade — Figurinhas Copa 2026

**Última atualização:** 16 de maio de 2026

## 1. Quem somos

O aplicativo **Figurinhas Copa 2026** ("Aplicativo", "nós") é desenvolvido por **Heitor Augustaitis de Oliveira** ("Controlador dos dados"), pessoa física com sede no Brasil.

Esta Política de Privacidade descreve como tratamos suas informações pessoais quando você usa o Aplicativo, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018), com as políticas da App Store da Apple e com a Data Safety do Google Play.

Ao usar o Aplicativo, você concorda com as práticas descritas aqui.

## 2. Dados que coletamos

### 2.1 Informações que você nos fornece

| Dado | Finalidade | Base legal (LGPD) |
|---|---|---|
| Endereço de e-mail | Autenticação da conta | Execução de contrato |
| Senha (armazenada como hash) | Autenticação | Execução de contrato |
| Nome de exibição (opcional) | Perfil público no app | Consentimento |
| Cidade (opcional) | Matching geográfico para trocas presenciais | Consentimento |
| Lista de figurinhas que você possui ou procura | Funcionalidade central do app | Execução de contrato |

### 2.2 Informações coletadas automaticamente

| Dado | Finalidade | Base legal |
|---|---|---|
| Identificador de publicidade do dispositivo (IDFA no iOS, AAID no Android) | Exibir anúncios (apenas com seu consentimento via prompt nativo do sistema) | Consentimento |
| Tipo de dispositivo, sistema operacional, versão do app, idioma | Diagnóstico, compatibilidade | Legítimo interesse |
| Dados de uso agregados (telas visitadas, ações realizadas) | Melhoria do produto | Legítimo interesse |

### 2.3 Conteúdo que você envia voluntariamente

- **Fotos de figurinhas**: usadas exclusivamente para o reconhecimento óptico (OCR) do código da figurinha. As imagens são enviadas para a API do Google Gemini, processadas, e **descartadas após a leitura do código**. Não armazenamos as imagens originais em nossos servidores.

## 3. Como usamos seus dados

Usamos os dados para:

- Operar funcionalidades essenciais do app: criar e autenticar sua conta, sincronizar sua coleção, conectar você com outros usuários para trocas.
- Reconhecer figurinhas a partir de fotos (OCR via Google Gemini).
- Exibir anúncios (Google AdMob) — apenas se você for usuário da versão gratuita e tiver consentido com tracking.
- Processar pagamentos de assinatura premium (quando aplicável), via App Store ou Google Play.
- Entender o uso agregado do app para corrigir bugs e priorizar melhorias.
- Enviar comunicações sobre o serviço (mudanças relevantes, suporte).

## 4. Compartilhamento com terceiros

Compartilhamos seus dados **somente** com prestadores que viabilizam o funcionamento do Aplicativo:

| Terceiro | Finalidade | Política deles |
|---|---|---|
| **Supabase, Inc.** (EUA) | Armazenamento de conta e coleção (banco de dados Postgres em infraestrutura AWS) | https://supabase.com/privacy |
| **Google LLC (Gemini API)** | OCR de figurinhas | https://policies.google.com/privacy |
| **Google LLC (AdMob)** | Exibição de anúncios | https://policies.google.com/privacy |
| **Apple Inc.** | Processamento de compras in-app (apenas iOS) | https://www.apple.com/legal/privacy/ |
| **Google LLC (Play Billing)** | Processamento de compras in-app (apenas Android) | https://policies.google.com/privacy |

**Não vendemos seus dados pessoais.** Não compartilhamos com fins de marketing fora da nossa relação direta com você.

## 5. Transferência internacional

Alguns dos nossos prestadores (Supabase, Google, Apple) processam dados em servidores fora do Brasil, principalmente nos Estados Unidos. Esses transferências são amparadas por cláusulas contratuais padrão e por outros mecanismos previstos no Art. 33 da LGPD.

## 6. Segurança

Aplicamos as seguintes medidas:

- Conexões HTTPS/TLS para toda comunicação entre app e servidor
- Senhas armazenadas exclusivamente como hash (bcrypt)
- Row-Level Security (RLS) no banco de dados Postgres, garantindo que cada usuário acesse apenas seus próprios registros
- Tokens de autenticação com expiração curta (JWT)

Nenhum sistema é 100% seguro. Em caso de incidente que afete seus dados, notificaremos você nos prazos e formas previstos pela LGPD.

## 7. Seus direitos (LGPD)

Você tem direito a, a qualquer momento:

- **Confirmar** se tratamos dados seus
- **Acessar** os dados que mantemos sobre você
- **Corrigir** dados incompletos, inexatos ou desatualizados
- **Anonimizar, bloquear ou excluir** dados desnecessários
- **Solicitar portabilidade** dos seus dados
- **Eliminar** os dados tratados com base em consentimento
- **Revogar** qualquer consentimento dado
- **Opor-se** a tratamento baseado em legítimo interesse

Para exercer qualquer desses direitos, envie um e-mail para: **heitorolial@gmail.com** com o assunto "LGPD — [tipo de solicitação]". Responderemos em até 15 dias.

### Encarregado pelo Tratamento de Dados (DPO)

Heitor Augustaitis de Oliveira — heitorolial@gmail.com

## 8. Crianças e adolescentes

O Aplicativo é direcionado a usuários com **13 anos ou mais**. Não coletamos intencionalmente dados de menores de 13. Se você é responsável legal por uma criança e acredita que ela enviou dados pessoais, entre em contato no e-mail acima e tomaremos providências para remover.

## 9. Retenção

| Tipo de dado | Prazo |
|---|---|
| Dados de conta | Enquanto sua conta estiver ativa, e por até 90 dias após sua exclusão |
| Imagens enviadas para OCR | Descartadas imediatamente após processamento (não armazenamos) |
| Dados de uso (agregados/anonimizados) | Indeterminado |
| Logs técnicos | 90 dias |

Você pode solicitar a exclusão completa da sua conta a qualquer momento pelo e-mail de contato.

## 10. Cookies e tecnologias similares

O Aplicativo é nativo (iOS/Android) e **não usa cookies**. Usa apenas armazenamento local seguro (AsyncStorage, Keychain/Keystore do sistema) para guardar a sessão de login e preferências.

## 11. Alterações desta Política

Podemos atualizar esta Política periodicamente. Mudanças relevantes serão comunicadas dentro do Aplicativo ou por e-mail. A data no topo indica a versão vigente. O uso continuado após a atualização implica aceitação da nova versão.

## 12. Contato

Dúvidas, solicitações ou reclamações:

**E-mail:** heitorolial@gmail.com
**Responsável:** Heitor Augustaitis de Oliveira

Você também pode contatar a Autoridade Nacional de Proteção de Dados (ANPD) em https://www.gov.br/anpd
