from pathlib import Path

p = Path(__file__).resolve().parents[1] / "src/components/ModalStockMovement.tsx"
head = p.read_text(encoding="utf-8").split("  if (!isOpen)")[0]
D = "</" + "motionlessModal>"
D = "</" + "motionlessModal>"
D = "</" + "motionlessModal>"
D = "</" + "div>"

form = f"""
  if (!isOpen) {{
    return null;
  }}

  return (
    <div className="modal-bg open" role="presentation">
      <div className="modal modal-lg" role="dialog" aria-modal="true">
        <div className="modal-hd">
          <h2>{{title}}</h2>
          <button className="modal-close" type="button" onClick={{onClose}} aria-label="Fermer">✕</button>
        {D}
        <form onSubmit={{handleSubmit}}>
          <div className="form-grid">
            <motionlessModal />
          {D}
          <div className="modal-ft">
            <button className="btn btn-outline" type="button" onClick={{onClose}}>Annuler</button>
            <button className="btn btn-gold" type="submit" disabled={{busy}}>{{busy ? "Enregistrement…" : "Enregistrer"}}</button>
          {D}
        </form>
      {D}
    {D}
  );
}}
"""
form = form.replace("<motionlessModal />", f"""            <div className="fg full">
              <label>Type de mouvement</label>
              <select className="fs" value={{category}} onChange={{(e) => setCategory(e.target.value as MovementUiType)}}>
                {{CATEGORY_OPTIONS.map((c) => (
                  <option key={{c}} value={{c}}>{{c}}</option>
                ))}}
              </select>
            {D}
            <div className="fg">
              <label>Motif</label>
              <select className="fs" value={{reason}} onChange={{(e) => setReason(e.target.value as MovementReason)}}>
                {{reasonOptions.map((r) => (
                  <option key={{r}} value={{r}}>{{MOVEMENT_REASON_LABELS[r]}}</option>
                ))}}
              </select>
            {D}
            <motionlessModal />""")

# second replace for article row
form = form.replace(
    f"""            <motionlessModal />""",
    f"""            <div className="fg full">
              <label>Article *</label>
              <select className="fs" required value={{artId}} onChange={{(e) => setArtId(e.target.value)}}>
                <option value="">— Sélectionner —</option>
                {{articleOptions.map((o) => (
                  <option key={{o.value}} value={{o.value}}>{{o.label}}</option>
                ))}}
              </select>
            {D}
            <div className="fg">
              <label>Quantité *</label>
              <input className="fi" type="number" min={{1}} required value={{qty}} onChange={{(e) => setQty(Number.parseInt(e.target.value, 10) || 1)}} />
            {D}
            {{showEvent ? (
              <div className="fg full">
                <label>Événement</label>
                <select className="fs" value={{evId}} onChange={{(e) => setEvId(e.target.value)}}>
                  <option value="">— Aucun —</option>
                  {{eventOptions.map((o) => (
                    <option key={{o.value}} value={{o.value}}>{{o.label}}</option>
                  ))}}
                </select>
              {D}
            ) : null}}
            {{showReturnState ? (
              <div className="fg">
                <label>État au retour</label>
                <select className="fs" value={{etat}} onChange={{(e) => setEtat(e.target.value as ReturnCondition)}}>
                  {{RETURN_CONDITIONS.map((c) => (
                    <option key={{c}} value={{c}}>{{c}}</option>
                  ))}}
                </select>
              {D}
            ) : null}}
            {{showTransfer ? (
              <>
                <div className="fg full">
                  <label>Emplacement source *</label>
                  <select className="fs" required value={{fromLocationId}} onChange={{(e) => setFromLocationId(e.target.value)}}>
                    <option value="">— Sélectionner —</option>
                    {{locationOptions.map((o) => (
                      <option key={{o.id}} value={{o.id}}>{{o.label}}</option>
                    ))}}
                  </select>
                {D}
                <div className="fg full">
                  <label>Emplacement destination *</label>
                  <select className="fs" required value={{toLocationId}} onChange={{(e) => setToLocationId(e.target.value)}}>
                    <option value="">— Sélectionner —</option>
                    {{locationOptions.map((o) => (
                      <option key={{o.id}} value={{o.id}}>{{o.label}}</option>
                    ))}}
                  </select>
                {D}
              </>
            ) : null}}
            {{showAdjustment ? (
              <div className="fg">
                <label>Quantité comptée *</label>
                <input className="fi" type="number" min={{0}} required value={{countedQty}} onChange={{(e) => setCountedQty(Number.parseInt(e.target.value, 10) || 0)}} />
              {D}
            ) : null}}
            <div className="fg full">
              <label>Notes</label>
              <textarea className="ft" rows={{2}} value={{note}} onChange={{(e) => setNote(e.target.value)}} />
            {D}""",
    1,
)

p.write_text(head + form, encoding="utf-8")
print("ok")
