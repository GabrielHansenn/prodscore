/**
 * Testes do componente EnrollMFA.
 * Cliente Supabase é mockado para isolar o fluxo de ativação/desativação de 2FA.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const {
  mockListTOTPFactors,
  mockEnrollTOTP,
  mockVerifyTOTPChallenge,
  mockUnenrollTOTP,
} = vi.hoisted(() => ({
  mockListTOTPFactors:     vi.fn(),
  mockEnrollTOTP:          vi.fn(),
  mockVerifyTOTPChallenge: vi.fn(),
  mockUnenrollTOTP:        vi.fn(),
}));

vi.mock('../lib/supabase.js', () => ({
  listTOTPFactors:     mockListTOTPFactors,
  enrollTOTP:          mockEnrollTOTP,
  verifyTOTPChallenge: mockVerifyTOTPChallenge,
  unenrollTOTP:        mockUnenrollTOTP,
  translateMFAErrorMessage: (msg: string) =>
    msg.toLowerCase().includes('invalid')
      ? 'Código inválido. Verifique o aplicativo autenticador e tente novamente.'
      : 'Não foi possível confirmar o código. Tente novamente.',
}));

import EnrollMFA from '../components/EnrollMFA';

const enrollment = {
  factorId:   'factor-1',
  qrCodeSvg:  '<svg></svg>',
  secret:     'JBSWY3DPEHPK3PXP',
  otpauthUri: 'otpauth://totp/ProdScore?secret=JBSWY3DPEHPK3PXP',
};

describe('EnrollMFA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve renderizar o QR code ao montar quando não há fator ativo', async () => {
    mockListTOTPFactors.mockResolvedValue({ factors: [], error: null });
    mockEnrollTOTP.mockResolvedValue({ data: enrollment, error: null });

    render(<EnrollMFA />);

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'QR code para ativação do 2FA' })).toBeInTheDocument();
    });

    expect(mockEnrollTOTP).toHaveBeenCalledTimes(1);
    expect(screen.getByText(enrollment.secret)).toBeInTheDocument();
  });

  it('não deve exibir o prefixo de data URI como texto quando qrCodeSvg vem com ele grudado', async () => {
    mockListTOTPFactors.mockResolvedValue({ factors: [], error: null });
    mockEnrollTOTP.mockResolvedValue({
      data: { ...enrollment, qrCodeSvg: `data:image/svg+xml;utf-8,${enrollment.qrCodeSvg}` },
      error: null,
    });

    render(<EnrollMFA />);

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'QR code para ativação do 2FA' })).toBeInTheDocument();
    });

    expect(screen.queryByText(/data:image\/svg\+xml/)).not.toBeInTheDocument();
  });

  it('deve remover fatores não verificados órfãos antes de iniciar um novo enrollment', async () => {
    mockListTOTPFactors.mockResolvedValue({
      factors: [
        { id: 'orfao-1', friendlyName: 'ProdScore', status: 'unverified', createdAt: '2025-01-01T00:00:00.000Z' },
        { id: 'orfao-2', friendlyName: 'ProdScore', status: 'unverified', createdAt: '2025-01-01T00:00:00.000Z' },
      ],
      error: null,
    });
    mockUnenrollTOTP.mockResolvedValue({ data: null, error: null });
    mockEnrollTOTP.mockResolvedValue({ data: enrollment, error: null });

    render(<EnrollMFA />);

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'QR code para ativação do 2FA' })).toBeInTheDocument();
    });

    expect(mockUnenrollTOTP).toHaveBeenCalledWith('orfao-1');
    expect(mockUnenrollTOTP).toHaveBeenCalledWith('orfao-2');
    expect(mockEnrollTOTP).toHaveBeenCalledTimes(1);
  });

  it('deve chamar verifyTOTPChallenge ao confirmar o código e mostrar sucesso', async () => {
    mockListTOTPFactors.mockResolvedValue({ factors: [], error: null });
    mockEnrollTOTP.mockResolvedValue({ data: enrollment, error: null });
    mockVerifyTOTPChallenge.mockResolvedValue({ data: { accessToken: 'a', refreshToken: 'b' }, error: null });

    render(<EnrollMFA />);

    await waitFor(() => screen.getByLabelText('Código de 6 dígitos'));

    await userEvent.type(screen.getByLabelText('Código de 6 dígitos'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Ativar' }));

    await waitFor(() => {
      expect(screen.getByText('2FA ativado com sucesso!')).toBeInTheDocument();
    });

    expect(mockVerifyTOTPChallenge).toHaveBeenCalledWith('factor-1', '123456');
  });

  it('deve exibir mensagem de erro em português quando o código é inválido', async () => {
    mockListTOTPFactors.mockResolvedValue({ factors: [], error: null });
    mockEnrollTOTP.mockResolvedValue({ data: enrollment, error: null });
    mockVerifyTOTPChallenge.mockResolvedValue({ data: null, error: 'Invalid TOTP code entered' });

    render(<EnrollMFA />);

    await waitFor(() => screen.getByLabelText('Código de 6 dígitos'));

    await userEvent.type(screen.getByLabelText('Código de 6 dígitos'), '000000');
    await userEvent.click(screen.getByRole('button', { name: 'Ativar' }));

    await waitFor(() => {
      expect(
        screen.getByText('Código inválido. Verifique o aplicativo autenticador e tente novamente.'),
      ).toBeInTheDocument();
    });
  });

  it('deve mostrar estado ativo e permitir desativar quando já existe fator verificado', async () => {
    mockListTOTPFactors.mockResolvedValue({
      factors: [{ id: 'factor-ativo', friendlyName: 'ProdScore', status: 'verified', createdAt: '2025-01-01T00:00:00.000Z' }],
      error:   null,
    });
    mockUnenrollTOTP.mockResolvedValue({ data: null, error: null });
    mockEnrollTOTP.mockResolvedValue({ data: enrollment, error: null });

    render(<EnrollMFA />);

    await waitFor(() => {
      expect(screen.getByText('Autenticação de dois fatores ativa')).toBeInTheDocument();
    });

    // Não deve tentar iniciar um novo enrollment enquanto já há um fator ativo
    expect(mockEnrollTOTP).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Desativar 2FA' }));

    await waitFor(() => {
      expect(mockUnenrollTOTP).toHaveBeenCalledWith('factor-ativo');
    });
  });
});
