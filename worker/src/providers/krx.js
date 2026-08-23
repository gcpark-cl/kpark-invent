export async function getKRXQuote(env,ticker){
 if(!env.KRX_API_KEY)return {ok:false,mode:"demo",reason:"KRX_API_KEY missing"};
 throw new Error("KRX provider endpoint/auth mapping is pending official approved API specification.");
}
