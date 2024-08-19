using TMPro;
using UnityEngine;

public class Counter : MonoBehaviour
{
    [SerializeField] private int count;

    [SerializeField] private TextMeshProUGUI text;

    private void Start()
    {
        text.text = count.ToString();
    }

    public void AddCounter()
    {
        count++;
        text.text = count.ToString();
    }
}
