"""Gera PDFs FICTÍCIOS no mesmo layout do PDF de OS do HTS, para os testes.
Uso: python3 test/fixtures/gerar-os-pdf.py   (precisa do pacote reportlab)"""
import os
from reportlab.pdfgen import canvas

PASTA = os.path.dirname(os.path.abspath(__file__))


def os_pdf(nome, unidade, numero, itens_servico, itens_peca, total):
    c = canvas.Canvas(os.path.join(PASTA, nome), pagesize=(595.28, 841.89))
    c.setTitle(f"Ordem de Serviço #{numero}")
    c.setFont("Helvetica-Bold", 11)
    c.drawString(347, 813, unidade)
    c.setFont("Helvetica", 8)
    c.drawString(242, 801, "Rua Exemplo, 100 - Centro - Cidade - SP")
    c.drawString(24, 740, "Cliente:"); c.drawString(84, 740, "Cliente Ficticio da Silva")
    c.drawString(24, 725, "Endereço:"); c.drawString(84, 725, "Rua Inventada, 1, Centro - Cidade")
    c.drawString(24, 709, "Telefones:"); c.drawString(84, 709, "11 90000-0000")
    c.drawString(232, 709, "E-mail:"); c.drawString(262, 709, "cliente.ficticio@exemplo.com")
    c.drawString(24, 693, "Veículo:"); c.drawString(84, 693, "TST-1A23"); c.drawString(142, 693, "Carro Exemplo 1.0")
    c.drawString(24, 639, f"Ordem de Serviço #{numero}")
    c.drawString(348, 639, "Quinta-feira, 15 de Outubro de 2026, 17:40")
    c.drawString(24, 603, "Falhas")
    c.drawString(24, 587, "Texto livre sobre o problema, com valores como R$ 10,00 que não são itens")

    y = 508
    for titulo, itens in (("Serviços", itens_servico), ("Peças", itens_peca)):
        if not itens:
            continue
        c.drawString(24, y, titulo); c.drawString(399, y, "Valor"); c.drawString(467, y, "Qtd"); c.drawString(529, y, "Total")
        y -= 15
        subtotal = 0
        for linhas, valor, qtd in itens:
            c.drawString(24, y, linhas[0])
            c.drawString(396, y, f"R$ {valor:.2f}".replace(".", ","))
            c.drawString(483, y, f"{qtd:.2f}".replace(".", ","))
            c.drawString(526, y, f"R$ {valor * qtd:.2f}".replace(".", ","))
            for extra in linhas[1:]:
                y -= 12
                c.drawString(24, y, extra)
            subtotal += valor * qtd
            y -= 16
        c.drawString(526, y, f"R$ {subtotal:.2f}".replace(".", ","))
        y -= 45
    c.drawString(24, y, "TOTAL"); c.drawString(517, y, f"R$ {total:.2f}".replace(".", ","))
    c.save()


servicos = [(["Revisão Preço Fixo HT BASIC (SERVIÇOS: Inspeção do fluido de freio;", "Inspeção das lâmpadas. )"], 350.0, 1)]
pecas = [(["Óleo do motor 5w30"], 85.0, 4), (["Filtro de oleo"], 52.0, 1)]
os_pdf("os-vinhedo-ficticia.pdf", "High Torque Vinhedo", 9001, servicos, pecas, 742.0)
# TOTAL não bate com a soma dos itens (simula um desconto não detalhado).
os_pdf("os-total-divergente.pdf", "High Torque Kaizen", 9002, [], pecas, 350.0)
