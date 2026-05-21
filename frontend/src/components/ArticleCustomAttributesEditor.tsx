"use client";

type ArticleCustomAttributesEditorProps = {
  customFieldsText: string;
  technicalParams: string;
  certificationsText: string;
  safetyStandardsText: string;
  specialInstructions: string;
  onCustomFieldsTextChange: (value: string) => void;
  onTechnicalParamsChange: (value: string) => void;
  onCertificationsTextChange: (value: string) => void;
  onSafetyStandardsTextChange: (value: string) => void;
  onSpecialInstructionsChange: (value: string) => void;
};

export function ArticleCustomAttributesEditor({
  customFieldsText,
  technicalParams,
  certificationsText,
  safetyStandardsText,
  specialInstructions,
  onCustomFieldsTextChange,
  onTechnicalParamsChange,
  onCertificationsTextChange,
  onSafetyStandardsTextChange,
  onSpecialInstructionsChange,
}: ArticleCustomAttributesEditorProps) {
  return (
    <>
      <p className="form-section-title">Attributs personnalisés</p>
      <div className="form-grid form-premium">
        <div className="fg full">
          <label htmlFor="art-custom-fields">Champs personnalisés (une ligne par attribut : clé: valeur)</label>
          <textarea
            id="art-custom-fields"
            className="ft mono"
            rows={4}
            placeholder={"Puissance: 1500\nMatériau: Acier\nIndice IP: IP65"}
            value={customFieldsText}
            onChange={(e) => onCustomFieldsTextChange(e.target.value)}
          />
          <span className="fs11 fc-3">Ex. charge max, type de prise, compatibilité tente…</span>
        </div>
        <div className="fg full">
          <label htmlFor="art-technical">Paramètres techniques</label>
          <textarea
            id="art-technical"
            className="ft"
            rows={3}
            placeholder="Tension, dimensions montage, consommation, protocoles…"
            value={technicalParams}
            onChange={(e) => onTechnicalParamsChange(e.target.value)}
          />
        </div>
        <div className="fg full">
          <label htmlFor="art-certs">Certifications (une par ligne)</label>
          <textarea
            id="art-certs"
            className="ft"
            rows={3}
            placeholder={"CE\nNF\nISO 9001"}
            value={certificationsText}
            onChange={(e) => onCertificationsTextChange(e.target.value)}
          />
        </div>
        <div className="fg full">
          <label htmlFor="art-safety">Normes de sécurité (une par ligne)</label>
          <textarea
            id="art-safety"
            className="ft"
            rows={3}
            placeholder={"EN 14960\nDirective machines 2006/42/CE"}
            value={safetyStandardsText}
            onChange={(e) => onSafetyStandardsTextChange(e.target.value)}
          />
        </div>
        <div className="fg full">
          <label htmlFor="art-instructions">Instructions spéciales</label>
          <textarea
            id="art-instructions"
            className="ft"
            rows={3}
            placeholder="Manipulation, stockage, montage, restrictions d'usage…"
            value={specialInstructions}
            onChange={(e) => onSpecialInstructionsChange(e.target.value)}
          />
        </div>
      </div>
    </>
  );
}
