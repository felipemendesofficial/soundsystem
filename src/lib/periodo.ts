export function paraISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function primeiroDiaDoMesISO(d: Date) {
  return paraISO(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function ultimoDiaDoMesISO(d: Date) {
  return paraISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

// Intervalo do período em horário local (mesmo critério do resto do app — ex.:
// `intervaloDoDia` em Lançamentos), incluindo o dia final inteiro.
export function intervaloPeriodo(inicioISO: string, fimISO: string) {
  const [anoI, mesI, diaI] = inicioISO.split("-").map(Number);
  const [anoF, mesF, diaF] = fimISO.split("-").map(Number);
  return { gte: new Date(anoI, mesI - 1, diaI), lt: new Date(anoF, mesF - 1, diaF + 1) };
}
