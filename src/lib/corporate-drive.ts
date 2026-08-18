/**
 * BIBLIOTECA CORPORATIVA — destino oficial no Drive da Velox.
 *
 * O link JAMAIS pode ser o Drive genérico: abrir "drive.google.com" faz
 * o navegador escolher a conta pessoal atualmente logada. Aqui o destino
 * é a pasta corporativa fixa do Portal. Se a conta ativa no navegador
 * não tiver acesso, o Google exibirá o pedido de acesso — o que é o
 * comportamento correto — em vez de abrir silenciosamente o Drive pessoal.
 */
export const CORPORATE_DRIVE_FOLDER_ID = "1PbM3GbROKTyVkt2RztugMpTAljsKivqb";

export const CORPORATE_DRIVE_URL = `https://drive.google.com/drive/folders/${CORPORATE_DRIVE_FOLDER_ID}`;
