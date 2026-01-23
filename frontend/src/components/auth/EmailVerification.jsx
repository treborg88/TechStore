import React, { useState, useEffect, useRef } from 'react';
import { sendVerificationCode, verifyCode } from '../../services/verificationService';
import './EmailVerification.css';
import { toast } from 'react-hot-toast';

/**
 * Componente para validación por correo electrónico.
 * 
 * @param {Object} props
 * @param {string} [props.initialEmail] - Email inicial (opcional). Si se provee, se salta el paso de ingreso de email.
 * @param {string} [props.email] - Alias de initialEmail.
 * @param {boolean} [props.lockEmail] - Si es true, no permite editar el correo.
 * @param {function} props.onVerified - Callback que se ejecuta cuando la validación es exitosa. Recibe el email validado.
 * @param {string} props.purpose - Propósito de la validación ('register', 'guest_checkout', 'payment').
 * @param {boolean} [props.autoSend] - Si es true y hay initialEmail, envía el código automáticamente al montar.
 * @param {function} [props.onBeforeSend] - Hook async antes de enviar código. Retorna false para bloquear el envío.
 */
const EmailVerification = ({ initialEmail = '', email: emailProp = '', lockEmail = false, onVerified, purpose = 'general', autoSend = false, onBeforeSend }) => {
  const resolvedInitialEmail = initialEmail || emailProp || '';
  const [email, setEmail] = useState(resolvedInitialEmail);
  const [code, setCode] = useState('');
  const [step, setStep] = useState(resolvedInitialEmail ? 'send_code' : 'input_email'); // input_email, send_code, verify_code, success
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const hasSentRef = useRef(false);

  useEffect(() => {
    if (resolvedInitialEmail) {
      setEmail(resolvedInitialEmail);
      setStep('send_code');
    }
  }, [resolvedInitialEmail]);

  // Recuperar estado previo (por si se recarga la página esperando el código)
  useEffect(() => {
    if (email && purpose) {
      const saved = localStorage.getItem(`verification_state_${email}_${purpose}`);
      if (saved) {
        try {
          const { step: savedStep, countdown: savedCountdown, timestamp } = JSON.parse(saved);
          const now = Date.now();
          const elapsed = Math.floor((now - timestamp) / 1000);
          
          // Solo restauramos si estábamos en medio de una verificación (verify_code)
          if (savedStep === 'verify_code') {
            setStep('verify_code');
            const remaining = savedCountdown - elapsed;
            setCountdown(remaining > 0 ? remaining : 0);
            hasSentRef.current = true; // Evitar auto-envío si ya se envió
          }
        } catch (e) {
          console.log('No hay estado de verificación previo válido');
        }
      }
    }
  }, [email, purpose]);

  // Guardar estado actual
  useEffect(() => {
    if (email && purpose && step !== 'success' && step !== 'input_email') {
      localStorage.setItem(`verification_state_${email}_${purpose}`, JSON.stringify({
        step,
        countdown,
        timestamp: Date.now()
      }));
    } else if (step === 'success') {
      localStorage.removeItem(`verification_state_${email}_${purpose}`);
    }
  }, [step, countdown, email, purpose]);

  useEffect(() => {
    if (autoSend && resolvedInitialEmail && step === 'send_code' && !hasSentRef.current) {
      hasSentRef.current = true;
      handleSendCode();
    }
  }, []);

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  const validateEmail = (email) => {
    return String(email)
      .toLowerCase()
      .match(
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
      );
  };

  const handleSendCode = async (e) => {
    if (e) e.preventDefault();
    setError('');

    if (!validateEmail(email)) {
      setError('Por favor ingresa un correo electrónico válido.');
      return;
    }

    setIsLoading(true);
    try {
      if (onBeforeSend) {
        const canSend = await onBeforeSend(email);
        if (canSend === false) {
          setIsLoading(false);
          return;
        }
      }
      await sendVerificationCode(email, purpose);
      setStep('verify_code');
      setCountdown(60); // 60 segundos para reenviar
      toast.success(`Código enviado a ${email}`);
    } catch (err) {
      setError(err.message || 'Error al enviar el código. Inténtalo de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    if (e) e.preventDefault();
    setError('');

    if (!code || code.length < 4) {
      setError('Por favor ingresa el código completo.');
      return;
    }

    setIsLoading(true);
    try {
      await verifyCode(email, code, purpose);
      setStep('success');
      toast.success('¡Correo verificado exitosamente!');
      if (onVerified) {
        onVerified(email, code);
      }
    } catch (err) {
      setError(err.message || 'Código inválido o expirado.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeEmail = () => {
    if (lockEmail) return;
    setStep('input_email');
    setCode('');
    setError('');
  };

  if (step === 'success') {
    return (
      <div className="email-verification-container">
        <div className="verification-message success">
          <p>✓ Verificación completada</p>
          <p><small>{email}</small></p>
        </div>
      </div>
    );
  }

  return (
    <div className="email-verification-container">
      <h3 className="email-verification-title">Verificación de Correo</h3>
      
      {step === 'input_email' && (
        <form onSubmit={handleSendCode} className="email-verification-form">
          <div className="verification-input-group">
            <label htmlFor="email">Correo Electrónico</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ejemplo@correo.com"
              className="verification-input"
              disabled={isLoading}
              required
            />
          </div>
          {error && <div className="verification-message error">{error}</div>}
          <button type="submit" className="verification-button" disabled={isLoading}>
            {isLoading ? 'Enviando...' : 'Enviar Código'}
          </button>
        </form>
      )}

      {step === 'send_code' && (
        <form onSubmit={handleSendCode} className="email-verification-form">
          <div className="verification-message">
            Enviar código a <strong>{email}</strong>
          </div>

          {error && <div className="verification-message error">{error}</div>}

          <button type="submit" className="verification-button" disabled={isLoading}>
            {isLoading ? 'Enviando...' : 'Enviar Código'}
          </button>
        </form>
      )}

      {step === 'verify_code' && (
        <form onSubmit={handleVerifyCode} className="email-verification-form">
          <div className="verification-message">
            Se ha enviado un código a <strong>{email}</strong>
            <br/>
            {!lockEmail && (
              <button type="button" onClick={handleChangeEmail} className="resend-link" style={{marginTop: '5px'}}>
                (Cambiar correo)
              </button>
            )}
          </div>
          
          <div className="verification-input-group">
            <label htmlFor="code">Código de Verificación</label>
            <input
              type="text"
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Ingresa el código"
              className="verification-input"
              disabled={isLoading}
              maxLength={6}
              required
            />
          </div>

          {error && <div className="verification-message error">{error}</div>}

          <div className="verification-actions">
            <button 
              type="button" 
              onClick={() => handleSendCode()} 
              className="resend-link"
              disabled={isLoading || countdown > 0}
            >
              {countdown > 0 ? `Reenviar en ${countdown}s` : 'Reenviar código'}
            </button>
            
            <button type="submit" className="verification-button" disabled={isLoading}>
              {isLoading ? 'Verificando...' : 'Verificar'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default EmailVerification;
